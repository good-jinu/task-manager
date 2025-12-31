import type { NotionTaskManager } from "@notion-task-manager/notion";
import { generateText, stepCountIs } from "ai";
import { getModel } from "../llm/provider";
import {
	type CreatePageOutput,
	createPageInputSchema,
	type ExecutionStep,
	executeCreatePage,
	executeSearchPages,
	executeUpdatePage,
	searchPagesInputSchema,
	type UpdatePageOutput,
	updatePageInputSchema,
} from "./tools";

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
 * Error result returned when a tool fails but execution should continue
 */
interface ToolErrorResult {
	error: string;
	recoverable: boolean;
}

/**
 * TaskManagerAgent orchestrates task management using AI SDK tool calling
 */
export class TaskManagerAgent {
	private model = getModel();

	/**
	 * Execute the agent with the given parameters
	 * The agent will:
	 * 1. Search for existing similar pages
	 * 2. Decide whether to create a new page or update an existing one
	 * 3. Execute the appropriate action
	 */
	async execute(params: AgentExecuteParams): Promise<AgentExecutionResult> {
		const { query, databaseId, notionManager, onStepComplete } = params;

		// Track what action was taken
		let lastAction: "created" | "updated" | "none" = "none";
		let lastPageId: string | undefined;
		let lastPageUrl: string | undefined;
		let lastPageTitle: string | undefined;
		let lastError: string | undefined;

		try {
			const result = await generateText({
				model: this.model,
				toolChoice: "required",
				stopWhen: stepCountIs(5), // Allow multiple tool calls
				tools: {
					search_pages: {
						description:
							"Search for existing pages in the Notion database that match the query. Always call this first to check for existing similar tasks before creating a new one.",
						inputSchema: searchPagesInputSchema,
						execute: async (input) => {
							// databaseId is fixed from user selection, passed at agent level
							return executeSearchPages(
								notionManager,
								databaseId,
								input,
								onStepComplete,
							);
						},
					},
					create_page: {
						description:
							"Create a new page in the Notion database. Only use this if search_pages found no similar existing pages (similarity < 0.7).",
						inputSchema: createPageInputSchema,
						execute: async (
							input,
						): Promise<CreatePageOutput | ToolErrorResult> => {
							try {
								// databaseId is fixed from user selection, passed at agent level
								const result = await executeCreatePage(
									notionManager,
									databaseId,
									input,
									onStepComplete,
								);
								lastAction = "created";
								lastPageId = result.pageId;
								lastPageUrl = result.pageUrl;
								lastPageTitle = input.title;
								return result;
							} catch (error) {
								// Record error but allow agent to continue with graceful degradation
								lastError =
									error instanceof Error ? error.message : "Unknown error";
								return {
									error: lastError,
									recoverable: false,
								};
							}
						},
					},
					update_page: {
						description:
							"Update an existing page in the Notion database. Use this when search_pages found a similar page (similarity >= 0.7) that should be updated with new information.",
						inputSchema: updatePageInputSchema,
						execute: async (
							input,
						): Promise<UpdatePageOutput | ToolErrorResult> => {
							try {
								const result = await executeUpdatePage(
									notionManager,
									input,
									onStepComplete,
								);
								lastAction = "updated";
								lastPageId = result.pageId;
								lastPageUrl = result.pageUrl;
								lastPageTitle = input.title;
								return result;
							} catch (error) {
								// Record error but allow agent to continue with graceful degradation
								lastError =
									error instanceof Error ? error.message : "Unknown error";
								return {
									error: lastError,
									recoverable: false,
								};
							}
						},
					},
				},
				system: `You are a task management agent that helps users manage their Notion tasks.
Your job is to process natural language task descriptions and either create new tasks or update existing ones.

IMPORTANT RULES:
1. ALWAYS call search_pages first to check for existing similar tasks
2. If a similar task exists (similarity >= 0.7), update it instead of creating a new one
3. If no similar task exists (similarity < 0.7), create a new task
4. Extract relevant information from the user's query (title, priority, due date if mentioned)
5. Be concise in your reasoning

When searching, use the key terms from the user's task description.
When creating or updating, use a clear, actionable title.`,
				prompt: `Process this task request and manage it in the Notion database (ID: ${databaseId}):

"${query}"

First search for existing similar tasks, then decide whether to create a new task or update an existing one.`,
			});

			// Extract reasoning from the final response
			const reasoning = result.text || "Task processed successfully";

			// If there was an error during tool execution, include it in reasoning
			if (lastError && lastAction === "none") {
				return {
					action: "none",
					reasoning: `Failed to complete task: ${lastError}`,
				};
			}

			return {
				action: lastAction,
				pageId: lastPageId,
				pageTitle: lastPageTitle,
				pageUrl: lastPageUrl,
				reasoning,
			};
		} catch (error) {
			// If an error occurs at the agent level, return a result indicating no action was taken
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			return {
				action: "none",
				reasoning: `Failed to process task: ${errorMessage}`,
			};
		}
	}
}
