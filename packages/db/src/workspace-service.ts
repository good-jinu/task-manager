import { randomUUID } from "node:crypto";
import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableName } from "./client";
import { TaskService } from "./task-service";
import type {
	CreateWorkspaceInput,
	UpdateWorkspaceInput,
	Workspace,
} from "./types";
import {
	validateCreateWorkspaceInput,
	validateUpdateWorkspaceInput,
	validateUserId,
	validateWorkspaceId,
} from "./validation";

export class WorkspaceService {
	private client = getDynamoDBClient();
	private get tableName() {
		return getTableName("workspaces");
	}
	private taskService = new TaskService();

	/**
	 * Creates a new workspace in the database
	 */
	async createWorkspace(
		userId: string,
		workspaceData: CreateWorkspaceInput,
	): Promise<Workspace> {
		// Validate input data
		validateUserId(userId);
		validateCreateWorkspaceInput(workspaceData);

		const now = new Date().toISOString();
		const workspace: Workspace = {
			id: randomUUID(),
			userId,
			name: workspaceData.name,
			description: workspaceData.description,
			createdAt: now,
			updatedAt: now,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.tableName,
					Item: workspace,
					// Prevent overwriting existing workspaces
					ConditionExpression: "attribute_not_exists(id)",
				}),
			);

			return workspace;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to create workspace: ${error.message}`);
			}
			throw new Error("Failed to create workspace: Unknown error");
		}
	}

	/**
	 * Retrieves a workspace by its ID
	 */
	async getWorkspace(workspaceId: string): Promise<Workspace | null> {
		// Validate input
		validateWorkspaceId(workspaceId);

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { id: workspaceId },
				}),
			);

			return (result.Item as Workspace) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get workspace: ${error.message}`);
			}
			throw new Error("Failed to get workspace: Unknown error");
		}
	}

	/**
	 * Updates an existing workspace
	 */
	async updateWorkspace(
		workspaceId: string,
		updates: UpdateWorkspaceInput,
	): Promise<Workspace> {
		// Validate inputs
		validateWorkspaceId(workspaceId);
		validateUpdateWorkspaceInput(updates);

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
					Key: { id: workspaceId },
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					// Ensure the workspace exists
					ConditionExpression: "attribute_exists(id)",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as Workspace;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(`Workspace with ID ${workspaceId} not found`);
				}
				throw new Error(`Failed to update workspace: ${error.message}`);
			}
			throw new Error("Failed to update workspace: Unknown error");
		}
	}

	/**
	 * Deletes a workspace and handles associated tasks according to policy
	 */
	async deleteWorkspace(
		workspaceId: string,
		taskPolicy: "archive" | "delete",
	): Promise<void> {
		// Validate input
		validateWorkspaceId(workspaceId);

		if (!["archive", "delete"].includes(taskPolicy)) {
			throw new Error("Task policy must be either 'archive' or 'delete'");
		}

		try {
			// First, handle all tasks in the workspace according to policy
			await this.handleWorkspaceTasks(workspaceId, taskPolicy);

			// Then delete the workspace
			await this.client.send(
				new DeleteCommand({
					TableName: this.tableName,
					Key: { id: workspaceId },
					// Ensure the workspace exists before deleting
					ConditionExpression: "attribute_exists(id)",
				}),
			);
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(`Workspace with ID ${workspaceId} not found`);
				}
				throw new Error(`Failed to delete workspace: ${error.message}`);
			}
			throw new Error("Failed to delete workspace: Unknown error");
		}
	}

	/**
	 * Lists all workspaces for a user
	 */
	async listWorkspaces(userId: string): Promise<Workspace[]> {
		// Validate input
		validateUserId(userId);

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "userId-index",
					KeyConditionExpression: "userId = :userId",
					ExpressionAttributeValues: {
						":userId": userId,
					},
					ScanIndexForward: false, // Most recent first
				}),
			);

			return (result.Items as Workspace[]) || [];
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to list workspaces: ${error.message}`);
			}
			throw new Error("Failed to list workspaces: Unknown error");
		}
	}

	/**
	 * Transfers ownership of a workspace from one user to another
	 */
	async transferWorkspaceOwnership(
		workspaceId: string,
		fromUserId: string,
		toUserId: string,
	): Promise<Workspace> {
		// Validate inputs
		validateWorkspaceId(workspaceId);
		validateUserId(fromUserId);
		validateUserId(toUserId);

		try {
			// First, verify the workspace exists and belongs to the fromUserId
			const workspace = await this.getWorkspace(workspaceId);
			if (!workspace) {
				throw new Error(`Workspace with ID ${workspaceId} not found`);
			}

			if (workspace.userId !== fromUserId) {
				throw new Error(
					`Workspace ${workspaceId} does not belong to user ${fromUserId}`,
				);
			}

			// Update the workspace ownership
			const result = await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { id: workspaceId },
					UpdateExpression: "SET userId = :toUserId, updatedAt = :updatedAt",
					ExpressionAttributeValues: {
						":toUserId": toUserId,
						":updatedAt": new Date().toISOString(),
						":fromUserId": fromUserId,
					},
					ConditionExpression: "attribute_exists(id) AND userId = :fromUserId",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as Workspace;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Failed to transfer workspace: workspace not found or ownership mismatch`,
					);
				}
				throw new Error(`Failed to transfer workspace: ${error.message}`);
			}
			throw new Error("Failed to transfer workspace: Unknown error");
		}
	}

	/**
	 * Handles tasks in a workspace according to the specified policy
	 */
	private async handleWorkspaceTasks(
		workspaceId: string,
		policy: "archive" | "delete",
	): Promise<void> {
		try {
			// Get all tasks in the workspace
			let hasMore = true;
			let cursor: string | undefined;

			while (hasMore) {
				const result = await this.taskService.listTasks(workspaceId, {
					limit: 100,
					cursor,
				});

				// Process each task according to policy
				for (const task of result.items) {
					if (policy === "archive") {
						// Archive the task
						await this.taskService.updateTask(task.id, {
							status: "archived",
						});
					} else if (policy === "delete") {
						// Delete the task
						await this.taskService.deleteTask(task.id);
					}
				}

				hasMore = result.hasMore;
				cursor = result.nextCursor;
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to handle workspace tasks: ${error.message}`);
			}
			throw new Error("Failed to handle workspace tasks: Unknown error");
		}
	}
}
