import type { NotionTaskManager } from "@notion-task-manager/notion";

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
