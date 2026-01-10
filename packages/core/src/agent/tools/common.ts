import type { NotionTaskManager } from "@notion-task-manager/notion";
import type { Tool } from "ai";
import {
	type CreatePageInput,
	createPageInputSchema,
	executeCreatePage,
	executeSearchPages,
	executeUpdatePage,
	type SearchPagesInput,
	searchPagesInputSchema,
	type UpdatePageInput,
	updatePageInputSchema,
} from "./";

/**
 * Execution step recorded during tool execution
 */
export interface ExecutionStep {
	stepId: string;
	toolName: string;
	input: Record<string, unknown>;
	output?: Record<string, unknown>;
	error?: string;
	timestamp: string;
}

/**
 * Tool common argument fields
 */
export interface ToolCommonArgs {
	/**
	 * The Notion database ID to use for the tool.
	 */
	databaseId?: string;
	/**
	 * The Notion Manager instance to use for the tool.
	 */
	notionManager?: NotionTaskManager;
}

/**
 * Factory function to create AI SDK tools configuration
 */
export function createNotionExecutorFactory(
	notionManager: NotionTaskManager,
	databaseId: string,
	onStepComplete?: (step: ExecutionStep) => Promise<void>,
) {
	const toolCommonArgs: ToolCommonArgs = {
		databaseId,
		notionManager,
	};

	async function funcWrapper<I>(params: {
		func: (input: ToolCommonArgs & I) => Promise<unknown>;
	}) {
		return async (input: I) => {
			const mergedInput = { ...toolCommonArgs, ...input };

			// Helper function to safely serialize objects for DynamoDB
			const safeSerialize = (obj: unknown): Record<string, unknown> => {
				try {
					return JSON.parse(JSON.stringify(obj));
				} catch {
					return { serialized: String(obj) };
				}
			};

			try {
				const output = await params.func(mergedInput);
				onStepComplete?.({
					stepId: crypto.randomUUID(),
					toolName: params.func.name,
					input: safeSerialize(input),
					output: safeSerialize(output),
					timestamp: new Date().toISOString(),
				});
				return output;
			} catch (error) {
				onStepComplete?.({
					stepId: crypto.randomUUID(),
					toolName: params.func.name,
					input: safeSerialize(input),
					error: (error as Error).message,
					timestamp: new Date().toISOString(),
				});
				throw error;
			}
		};
	}

	return (toolsConfig: {
		search_pages?: boolean;
		create_page?: boolean;
		update_page?: boolean;
	}) => {
		const tools: Record<string, Tool> = {};

		if (toolsConfig.search_pages) {
			tools.search_pages = {
				description:
					"Search for existing pages in the Notion database that match the query. Always call this first to check for existing similar tasks before creating a new one.",
				inputSchema: searchPagesInputSchema,
				execute: async (input: SearchPagesInput) => {
					const wrapper = await funcWrapper({
						func: executeSearchPages,
					});
					return await wrapper({ input });
				},
			};
		}

		if (toolsConfig.create_page) {
			tools.create_page = {
				description:
					"Create a new page in the Notion database. Only use this if search_pages found no similar existing pages.",
				inputSchema: createPageInputSchema,
				execute: async (input: CreatePageInput) => {
					const wrapper = await funcWrapper({
						func: executeCreatePage,
					});
					return await wrapper({ input });
				},
			};
		}

		if (toolsConfig.update_page) {
			tools.update_page = {
				description:
					"Update the content of an existing page in the Notion database. Use this when search_pages found a similar page that should be updated with new information or additional content.",
				inputSchema: updatePageInputSchema,
				execute: async (input: UpdatePageInput) => {
					const wrapper = await funcWrapper({
						func: executeUpdatePage,
					});
					return await wrapper({ input });
				},
			};
		}

		return tools;
	};
}
