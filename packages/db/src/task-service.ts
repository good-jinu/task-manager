import { randomUUID } from "node:crypto";
import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableNames } from "./client.js";
import type {
	CreateTaskInput,
	Task,
	TaskFilter,
	UpdateTaskInput,
} from "./types.js";
import { TaskStatus } from "./types.js";
import {
	validateCreateTaskInput,
	validateTaskId,
	validateUpdateTaskInput,
	validateUserId,
} from "./validation.js";

export class TaskService {
	private client = getDynamoDBClient();
	private tableName = getTableNames().tasks;

	/**
	 * Creates a new task associated with a user
	 */
	async createTask(userId: string, taskData: CreateTaskInput): Promise<Task> {
		// Validate inputs
		validateUserId(userId);
		validateCreateTaskInput(taskData);

		const now = new Date();
		const task: Task = {
			id: randomUUID(),
			userId,
			status: TaskStatus.TODO,
			tags: [],
			...taskData,
			createdAt: now,
			updatedAt: now,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.tableName,
					Item: task,
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
	 * Retrieves all tasks for a specific user with optional filtering
	 */
	async getTasksByUser(userId: string, filters?: TaskFilter): Promise<Task[]> {
		// Validate input
		validateUserId(userId);

		try {
			const keyConditionExpression = "userId = :userId";
			const expressionAttributeValues: Record<string, string | string[]> = {
				":userId": userId,
			};

			// Build filter expression if filters are provided
			let filterExpression: string | undefined;
			const filterExpressions: string[] = [];

			if (filters) {
				if (filters.status && filters.status.length > 0) {
					filterExpressions.push(
						`#status IN (${filters.status.map((_, i) => `:status${i}`).join(", ")})`,
					);
					filters.status.forEach((status, i) => {
						expressionAttributeValues[`:status${i}`] = status;
					});
				}

				if (filters.priority && filters.priority.length > 0) {
					filterExpressions.push(
						`priority IN (${filters.priority.map((_, i) => `:priority${i}`).join(", ")})`,
					);
					filters.priority.forEach((priority, i) => {
						expressionAttributeValues[`:priority${i}`] = priority;
					});
				}

				if (filters.assignee) {
					filterExpressions.push("assignee = :assignee");
					expressionAttributeValues[":assignee"] = filters.assignee;
				}

				if (filters.dueBefore) {
					filterExpressions.push("dueDate < :dueBefore");
					expressionAttributeValues[":dueBefore"] =
						filters.dueBefore.toISOString();
				}

				if (filters.dueAfter) {
					filterExpressions.push("dueDate > :dueAfter");
					expressionAttributeValues[":dueAfter"] =
						filters.dueAfter.toISOString();
				}

				if (filters.tags && filters.tags.length > 0) {
					const tagConditions = filters.tags.map(
						(_, i) => `contains(tags, :tag${i})`,
					);
					filterExpressions.push(`(${tagConditions.join(" OR ")})`);
					filters.tags.forEach((tag, i) => {
						expressionAttributeValues[`:tag${i}`] = tag;
					});
				}

				if (filterExpressions.length > 0) {
					filterExpression = filterExpressions.join(" AND ");
				}
			}

			// biome-ignore lint/suspicious/noExplicitAny: DynamoDB QueryCommand requires flexible parameter structure
			const queryParams: any = {
				TableName: this.tableName,
				KeyConditionExpression: keyConditionExpression,
				ExpressionAttributeValues: expressionAttributeValues,
			};

			// Add status attribute name mapping if needed
			if (filters?.status && filters.status.length > 0) {
				queryParams.ExpressionAttributeNames = { "#status": "status" };
			}

			if (filterExpression) {
				queryParams.FilterExpression = filterExpression;
			}

			const result = await this.client.send(new QueryCommand(queryParams));

			return (result.Items as Task[]) || [];
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get tasks: ${error.message}`);
			}
			throw new Error("Failed to get tasks: Unknown error");
		}
	}

	/**
	 * Retrieves a specific task by user ID and task ID
	 */
	async getTask(userId: string, taskId: string): Promise<Task | null> {
		// Validate inputs
		validateUserId(userId);
		validateTaskId(taskId);

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: {
						userId,
						id: taskId,
					},
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
	async updateTask(
		userId: string,
		taskId: string,
		updates: UpdateTaskInput,
	): Promise<Task> {
		// Validate inputs
		validateUserId(userId);
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
		expressionAttributeValues[":updatedAt"] = new Date();

		if (updateExpressions.length === 1) {
			// Only updatedAt was added, no actual updates
			throw new Error("No valid updates provided");
		}

		try {
			const result = await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: {
						userId,
						id: taskId,
					},
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					// Ensure the task exists and belongs to the user
					ConditionExpression:
						"attribute_exists(userId) AND attribute_exists(id)",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as Task;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Task with ID ${taskId} not found for user ${userId}`,
					);
				}
				throw new Error(`Failed to update task: ${error.message}`);
			}
			throw new Error("Failed to update task: Unknown error");
		}
	}

	/**
	 * Deletes a task
	 */
	async deleteTask(userId: string, taskId: string): Promise<void> {
		// Validate inputs
		validateUserId(userId);
		validateTaskId(taskId);

		try {
			await this.client.send(
				new DeleteCommand({
					TableName: this.tableName,
					Key: {
						userId,
						id: taskId,
					},
					// Ensure the task exists and belongs to the user
					ConditionExpression:
						"attribute_exists(userId) AND attribute_exists(id)",
				}),
			);
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Task with ID ${taskId} not found for user ${userId}`,
					);
				}
				throw new Error(`Failed to delete task: ${error.message}`);
			}
			throw new Error("Failed to delete task: Unknown error");
		}
	}
}
