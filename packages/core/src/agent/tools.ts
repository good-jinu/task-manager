import { randomUUID } from "node:crypto";
import type { NotionTaskManager } from "@notion-task-manager/notion";
import { z } from "zod";

/**
 * Zod schema for search_pages tool input
 * Note: databaseId is not included as it's fixed at the agent level from user selection
 */
export const searchPagesInputSchema = z.object({
	query: z.string().describe("The search query to find similar pages"),
	maxResults: z
		.number()
		.optional()
		.default(10)
		.describe("Maximum number of results to return"),
});

export type SearchPagesInput = z.infer<typeof searchPagesInputSchema>;

/**
 * Output from search_pages tool
 */
export interface SearchPagesOutput {
	pages: Array<{
		id: string;
		title: string;
		url: string;
		properties: Record<string, unknown>;
	}>;
}

/**
 * Zod schema for create_page tool input
 * Note: databaseId is not included as it's fixed at the agent level from user selection
 */
export const createPageInputSchema = z.object({
	title: z.string().describe("The title for the new page"),
	properties: z
		.record(z.unknown())
		.optional()
		.describe("Additional properties for the page"),
});

export type CreatePageInput = z.infer<typeof createPageInputSchema>;

/**
 * Output from create_page tool
 */
export interface CreatePageOutput {
	pageId: string;
	pageUrl: string;
}

/**
 * Zod schema for update_page tool input
 */
export const updatePageInputSchema = z.object({
	pageId: z.string().describe("The ID of the page to update"),
	title: z.string().optional().describe("New title for the page"),
	properties: z
		.record(z.unknown())
		.optional()
		.describe("Properties to update on the page"),
});

export type UpdatePageInput = z.infer<typeof updatePageInputSchema>;

/**
 * Output from update_page tool
 */
export interface UpdatePageOutput {
	pageId: string;
	pageUrl: string;
}

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
 * Creates a step record for tool execution
 */
function createStep(
	toolName: string,
	input: Record<string, unknown>,
): ExecutionStep {
	return {
		stepId: randomUUID(),
		toolName,
		input,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Execute search_pages tool
 * Searches for pages in a Notion database that match the query
 * @param notionManager - The Notion task manager instance
 * @param databaseId - The database ID (fixed from user selection)
 * @param input - The tool input (query and maxResults)
 * @param onStepComplete - Optional callback for step recording
 */
export async function executeSearchPages(
	notionManager: NotionTaskManager,
	databaseId: string,
	input: SearchPagesInput,
	onStepComplete?: (step: ExecutionStep) => Promise<void>,
): Promise<SearchPagesOutput> {
	const step = createStep("search_pages", { ...input, databaseId } as Record<
		string,
		unknown
	>);

	try {
		// Query the database for pages matching the title query
		const pages = await notionManager.queryDatabasePages(
			databaseId,
			input.query,
		);

		// Limit results
		const limitedPages = pages.slice(0, input.maxResults || 10);

		const output: SearchPagesOutput = {
			pages: limitedPages.map((page) => ({
				id: page.id,
				title: page.title,
				url: page.url,
				properties: page.properties as Record<string, unknown>,
			})),
		};

		step.output = output as unknown as Record<string, unknown>;
		if (onStepComplete) {
			await onStepComplete(step);
		}

		return output;
	} catch (error) {
		step.error = error instanceof Error ? error.message : "Unknown error";
		if (onStepComplete) {
			await onStepComplete(step);
		}
		// Return empty result on error to allow agent to continue
		return { pages: [] };
	}
}

/**
 * Error result returned when a tool fails
 */
export interface ToolErrorResult {
	error: string;
	recoverable: boolean;
}

/**
 * Execute create_page tool
 * Creates a new page in a Notion database
 * Returns error object on failure to allow agent to continue with graceful degradation
 * @param notionManager - The Notion task manager instance
 * @param databaseId - The database ID (fixed from user selection)
 * @param input - The tool input (title and properties)
 * @param onStepComplete - Optional callback for step recording
 */
export async function executeCreatePage(
	notionManager: NotionTaskManager,
	databaseId: string,
	input: CreatePageInput,
	onStepComplete?: (step: ExecutionStep) => Promise<void>,
): Promise<CreatePageOutput> {
	const step = createStep("create_page", { ...input, databaseId } as Record<
		string,
		unknown
	>);

	try {
		const page = await notionManager.createPage(databaseId, {
			title: input.title,
			...input.properties,
		});

		const output: CreatePageOutput = {
			pageId: page.id,
			pageUrl: page.url,
		};

		step.output = output as unknown as Record<string, unknown>;
		if (onStepComplete) {
			await onStepComplete(step);
		}

		return output;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		step.error = errorMessage;
		if (onStepComplete) {
			await onStepComplete(step);
		}
		// Re-throw with enhanced error message for the agent to handle
		throw new Error(`Failed to create page: ${errorMessage}`);
	}
}

/**
 * Execute update_page tool
 * Updates an existing Notion page
 * Returns error object on failure to allow agent to continue with graceful degradation
 */
export async function executeUpdatePage(
	notionManager: NotionTaskManager,
	input: UpdatePageInput,
	onStepComplete?: (step: ExecutionStep) => Promise<void>,
): Promise<UpdatePageOutput> {
	const step = createStep("update_page", input as Record<string, unknown>);

	try {
		const properties: Record<string, unknown> = {};
		if (input.title !== undefined) {
			properties.title = input.title;
		}
		if (input.properties) {
			Object.assign(properties, input.properties);
		}

		const page = await notionManager.updatePage(input.pageId, properties);

		const output: UpdatePageOutput = {
			pageId: page.id,
			pageUrl: page.url,
		};

		step.output = output as unknown as Record<string, unknown>;
		if (onStepComplete) {
			await onStepComplete(step);
		}

		return output;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		step.error = errorMessage;
		if (onStepComplete) {
			await onStepComplete(step);
		}
		// Re-throw with enhanced error message for the agent to handle
		throw new Error(`Failed to update page: ${errorMessage}`);
	}
}
