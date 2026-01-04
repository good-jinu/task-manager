import type { NotionTaskManager } from "@notion-task-manager/notion";
import { generateText, stepCountIs } from "ai";
import { getModel } from "../llm/provider";
import { createExecutorFactory, type ExecutionStep } from "./tools";

/**
 * Parameters for agent execution
 */
export interface AgentExecuteParams {
	userId: string;
	executionId: string;
	query: string;
	databaseId: string;
	notionManager: NotionTaskManager;
	onStepComplete?: (step: ExecutionStep) => Promise<void>;
}

/**
 * Result of agent execution
 */
export interface AgentExecutionResult {
	action: "created" | "updated" | "none";
	pageId?: string;
	pageTitle?: string;
	pageUrl?: string;
	reasoning: string;
}

/**
 * TaskManagerAgent orchestrates task management using AI SDK tool calling
 */
export class TaskManagerAgent {
	private model = getModel();

	/**
	 * Execute the agent with the given parameters
	 */
	async execute(params: AgentExecuteParams): Promise<AgentExecutionResult> {
		const { query, databaseId, notionManager, onStepComplete } = params;

		// Track what actions were performed
		let lastAction: "created" | "updated" | "none" = "none";
		let lastPageId: string | undefined;
		let lastPageUrl: string | undefined;
		let lastPageTitle: string | undefined;

		// Wrap onStepComplete to track actions
		const wrappedOnStepComplete = async (step: ExecutionStep) => {
			// Track the action based on tool name and output
			if (step.toolName === "executeCreatePage" && step.output) {
				lastAction = "created";
				const output = step.output as {
					pageId?: string;
					pageUrl?: string;
					pageTitle?: string;
				};
				lastPageId = output.pageId;
				lastPageUrl = output.pageUrl;
				lastPageTitle = output.pageTitle;
			} else if (step.toolName === "executeUpdatePage" && step.output) {
				lastAction = "updated";
				const output = step.output as {
					pageId?: string;
					pageUrl?: string;
					pageTitle?: string;
				};
				lastPageId = output.pageId;
				lastPageUrl = output.pageUrl;
				lastPageTitle = output.pageTitle;
			}

			// Call the original callback
			if (onStepComplete) {
				await onStepComplete(step);
			}
		};

		const factory = createExecutorFactory(
			notionManager,
			databaseId,
			wrappedOnStepComplete,
		);

		try {
			const result = await generateText({
				model: this.model,
				toolChoice: "required",
				stopWhen: stepCountIs(10),
				tools: factory({
					search_pages: true,
					create_page: true,
					update_page: true,
				}),
				system: `You are a task management agent that helps users manage their Notion tasks.
Your job is to process natural language task descriptions and either create new tasks or update existing ones.

IMPORTANT RULES:
1. BEFORE creating or updating any task, call search_pages with an ARRAY of relevant keywords extracted from the user's message.
2. Extract multiple search terms including: main topics, technologies, devices, error types, components, etc.
3. If a similar task exists, update its CONTENT with the new information (title and properties remain unchanged).
4. If no match after searching, create a new task.
5. When creating: Extract title, priority, due date if mentioned.
6. When updating: Add the new task information to the existing page content.
7. Keep reasoning concise.

SEARCH EXAMPLES:
Example 1: User says "Android UI crash on Samsung Galaxy One UI 7"
- Call: search_pages({query: ["android", "ui", "crash", "samsung", "galaxy", "one ui 7", "one ui", "bug", "error"]})

Example 2: User says "Fix login authentication timeout on iOS app"
- Call: search_pages({query: ["login", "authentication", "timeout", "ios", "app", "auth", "signin", "mobile"]})

When searching, use multiple relevant keywords from the user's task description.
When creating, use a clear, actionable title.
When updating, append or integrate the new information into the existing page content.`,
				prompt: `Process this task request and manage it in the Notion database:

"${query}"

First search for existing similar tasks, then decide whether to create a new task or update an existing one.`,
			});

			return {
				action: lastAction,
				pageId: lastPageId,
				pageTitle: lastPageTitle,
				pageUrl: lastPageUrl,
				reasoning: result.text || "Task processed successfully",
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			return {
				action: "none",
				reasoning: `Failed to process task: ${errorMessage}`,
			};
		}
	}
}
