import type { Task } from "@task-manager/db";

/**
 * Message payload for task execution queue
 */
export interface TaskExecutionMessage {
	userId: string;
	executionId: string;
	workspaceId: string;
	query: string;
	contextTasks: Task[];
}

/**
 * Result of sending a message to the queue
 */
export interface QueueSendResult {
	success: boolean;
	messageId?: string;
	error?: string;
}
