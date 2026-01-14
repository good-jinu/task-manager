import { randomUUID } from "node:crypto";
import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
	CreateTaskInput,
	TaskService as ITaskService,
	ListTasksOptions,
	PaginatedResult,
	Task,
	TaskStatus,
	UpdateTaskInput,
} from "@task-manager/core";
import { getDynamoDBClient, getTableName } from "./client";
import {
	validateCreateTaskInput,
	validateTaskId,
	validateUpdateTaskInput,
	validateWorkspaceId,
} from "./validation";

export class TaskService implements ITaskService {
	private client = getDynamoDBClient();
	private get tableName() {
		return getTableName("tasks");
	}

	/**
	 * Creates a new task in the database
	 */
	async createTask(taskData: CreateTaskInput): Promise<Task> {
		// Validate input data
		validateCreateTaskInput(taskData);

		const now = new Date().toISOString();
		const task: Task = {
			id: randomUUID(),
			workspaceId: taskData.workspaceId,
			title: taskData.title,
			content: taskData.content,
			status: taskData.status || "todo",
			priority: taskData.priority,
			dueDate: taskData.dueDate,
			archived: false,
			createdAt: now,
			updatedAt: now,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.tableName,
					Item: task,
					// Prevent overwriting existing tasks
					ConditionExpression: "attribute_not_exists(id)",
				}),
			);

			return task;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to create task: ${error.message}`);
			}
			throw new Error("Failed to create task: Unknown error");
		}
	}

	/**
	 * Retrieves a task by its ID
	 */
	async getTask(taskId: string): Promise<Task | null> {
		// Validate input
		validateTaskId(taskId);

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { id: taskId },
				}),
			);

			return (result.Item as Task) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get task: ${error.message}`);
			}
			throw new Error("Failed to get task: Unknown error");
		}
	}

	/**
	 * Updates an existing task
	 */
	async updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task> {
		// Validate inputs
		validateTaskId(taskId);
		validateUpdateTaskInput(updates);

		const updateExpressions: string[] = [];
		const expressionAttributeNames: Record<string, string> = {};
		const expressionAttributeValues: Record<string, unknown> = {};

		// Build update expression dynamically
		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) {
				updateExpressions.push(`#${key} = :${key}`);
				expressionAttributeNames[`#${key}`] = key;
				expressionAttributeValues[`:${key}`] = value;
			}
		}

		// Always update the updatedAt timestamp
		updateExpressions.push("#updatedAt = :updatedAt");
		expressionAttributeNames["#updatedAt"] = "updatedAt";
		expressionAttributeValues[":updatedAt"] = new Date().toISOString();

		if (updateExpressions.length === 1) {
			// Only updatedAt was added, no actual updates
			throw new Error("No valid updates provided");
		}

		try {
			const result = await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { id: taskId },
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					// Ensure the task exists
					ConditionExpression: "attribute_exists(id)",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as Task;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(`Task with ID ${taskId} not found`);
				}
				throw new Error(`Failed to update task: ${error.message}`);
			}
			throw new Error("Failed to update task: Unknown error");
		}
	}

	/**
	 * Deletes a task by its ID
	 */
	async deleteTask(taskId: string): Promise<void> {
		// Validate input
		validateTaskId(taskId);

		try {
			await this.client.send(
				new DeleteCommand({
					TableName: this.tableName,
					Key: { id: taskId },
					// Ensure the task exists before deleting
					ConditionExpression: "attribute_exists(id)",
				}),
			);
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(`Task with ID ${taskId} not found`);
				}
				throw new Error(`Failed to delete task: ${error.message}`);
			}
			throw new Error("Failed to delete task: Unknown error");
		}
	}

	/**
	 * Lists tasks for a workspace with pagination
	 */
	async listTasks(
		workspaceId: string,
		options: ListTasksOptions = {},
	): Promise<PaginatedResult<Task>> {
		// Validate input
		validateWorkspaceId(workspaceId);

		const { limit = 50, cursor } = options;

		try {
			const queryParams = {
				TableName: this.tableName,
				IndexName: "workspaceId-index",
				KeyConditionExpression: "workspaceId = :workspaceId",
				ExpressionAttributeValues: {
					":workspaceId": workspaceId,
				},
				Limit: limit,
				ScanIndexForward: false, // Most recent first
				...(cursor && {
					ExclusiveStartKey: JSON.parse(
						Buffer.from(cursor, "base64").toString("utf-8"),
					),
				}),
			};

			const result = await this.client.send(new QueryCommand(queryParams));

			const items = (result.Items as Task[]) || [];
			const hasMore = !!result.LastEvaluatedKey;
			const nextCursor = hasMore
				? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString(
						"base64",
					)
				: undefined;

			return {
				items,
				nextCursor,
				hasMore,
			};
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to list tasks: ${error.message}`);
			}
			throw new Error("Failed to list tasks: Unknown error");
		}
	}

	/**
	 * Lists tasks by status within a workspace
	 */
	async listTasksByStatus(
		workspaceId: string,
		status: TaskStatus,
		options: ListTasksOptions = {},
	): Promise<PaginatedResult<Task>> {
		// Validate input
		validateWorkspaceId(workspaceId);

		const validStatuses = ["todo", "in-progress", "done", "archived"];
		if (!validStatuses.includes(status)) {
			throw new Error(`Status must be one of: ${validStatuses.join(", ")}`);
		}

		const { limit = 50, cursor } = options;

		try {
			const queryParams = {
				TableName: this.tableName,
				IndexName: "workspaceId-status-index",
				KeyConditionExpression:
					"workspaceId = :workspaceId AND #status = :status",
				ExpressionAttributeNames: {
					"#status": "status",
				},
				ExpressionAttributeValues: {
					":workspaceId": workspaceId,
					":status": status,
				},
				Limit: limit,
				ScanIndexForward: false, // Most recent first
				...(cursor && {
					ExclusiveStartKey: JSON.parse(
						Buffer.from(cursor, "base64").toString("utf-8"),
					),
				}),
			};

			const result = await this.client.send(new QueryCommand(queryParams));

			const items = (result.Items as Task[]) || [];
			const hasMore = !!result.LastEvaluatedKey;
			const nextCursor = hasMore
				? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString(
						"base64",
					)
				: undefined;

			return {
				items,
				nextCursor,
				hasMore,
			};
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to list tasks by status: ${error.message}`);
			}
			throw new Error("Failed to list tasks by status: Unknown error");
		}
	}
}
