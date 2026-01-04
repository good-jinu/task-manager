import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableNames } from "./client";
import type {
	CreateSyncMetadataInput,
	SyncMetadata,
	SyncStatus,
	UpdateSyncMetadataInput,
} from "./types";
import {
	validateCreateSyncMetadataInput,
	validateIntegrationId,
	validateTaskId,
	validateUpdateSyncMetadataInput,
} from "./validation";

export class SyncMetadataService {
	private client = getDynamoDBClient();
	private tableName = getTableNames().syncMetadata;

	/**
	 * Creates new sync metadata in the database
	 */
	async createSyncMetadata(
		metadataData: CreateSyncMetadataInput,
	): Promise<SyncMetadata> {
		// Validate input data
		validateCreateSyncMetadataInput(metadataData);

		const syncMetadata: SyncMetadata = {
			taskId: metadataData.taskId,
			integrationId: metadataData.integrationId,
			externalId: metadataData.externalId,
			syncStatus: metadataData.syncStatus || "pending",
			lastExternalUpdate: metadataData.lastExternalUpdate,
			retryCount: 0,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.tableName,
					Item: syncMetadata,
					// Prevent overwriting existing sync metadata
					ConditionExpression:
						"attribute_not_exists(taskId) AND attribute_not_exists(integrationId)",
				}),
			);

			return syncMetadata;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Sync metadata already exists for task ${metadataData.taskId} and integration ${metadataData.integrationId}`,
					);
				}
				throw new Error(`Failed to create sync metadata: ${error.message}`);
			}
			throw new Error("Failed to create sync metadata: Unknown error");
		}
	}

	/**
	 * Retrieves sync metadata by task ID and integration ID
	 */
	async getSyncMetadata(
		taskId: string,
		integrationId: string,
	): Promise<SyncMetadata | null> {
		// Validate inputs
		validateTaskId(taskId);
		validateIntegrationId(integrationId);

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { taskId, integrationId },
				}),
			);

			return (result.Item as SyncMetadata) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get sync metadata: ${error.message}`);
			}
			throw new Error("Failed to get sync metadata: Unknown error");
		}
	}

	/**
	 * Retrieves sync metadata by external ID
	 */
	async getSyncMetadataByExternalId(
		externalId: string,
	): Promise<SyncMetadata | null> {
		if (!externalId || typeof externalId !== "string" || !externalId.trim()) {
			throw new Error("External ID is required and cannot be empty");
		}

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "externalId-index",
					KeyConditionExpression: "externalId = :externalId",
					ExpressionAttributeValues: {
						":externalId": externalId,
					},
					Limit: 1,
				}),
			);

			const items = result.Items as SyncMetadata[];
			return items && items.length > 0 ? items[0] : null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to get sync metadata by external ID: ${error.message}`,
				);
			}
			throw new Error(
				"Failed to get sync metadata by external ID: Unknown error",
			);
		}
	}

	/**
	 * Updates existing sync metadata
	 */
	async updateSyncMetadata(
		taskId: string,
		integrationId: string,
		updates: UpdateSyncMetadataInput,
	): Promise<SyncMetadata> {
		// Validate inputs
		validateTaskId(taskId);
		validateIntegrationId(integrationId);
		validateUpdateSyncMetadataInput(updates);

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

		if (updateExpressions.length === 0) {
			throw new Error("No valid updates provided");
		}

		try {
			const result = await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { taskId, integrationId },
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					// Ensure the sync metadata exists
					ConditionExpression:
						"attribute_exists(taskId) AND attribute_exists(integrationId)",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as SyncMetadata;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Sync metadata not found for task ${taskId} and integration ${integrationId}`,
					);
				}
				throw new Error(`Failed to update sync metadata: ${error.message}`);
			}
			throw new Error("Failed to update sync metadata: Unknown error");
		}
	}

	/**
	 * Deletes sync metadata by task ID and integration ID
	 */
	async deleteSyncMetadata(
		taskId: string,
		integrationId: string,
	): Promise<void> {
		// Validate inputs
		validateTaskId(taskId);
		validateIntegrationId(integrationId);

		try {
			await this.client.send(
				new DeleteCommand({
					TableName: this.tableName,
					Key: { taskId, integrationId },
					// Ensure the sync metadata exists before deleting
					ConditionExpression:
						"attribute_exists(taskId) AND attribute_exists(integrationId)",
				}),
			);
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Sync metadata not found for task ${taskId} and integration ${integrationId}`,
					);
				}
				throw new Error(`Failed to delete sync metadata: ${error.message}`);
			}
			throw new Error("Failed to delete sync metadata: Unknown error");
		}
	}

	/**
	 * Deletes all sync metadata for a task (when task is deleted)
	 */
	async deleteSyncMetadataForTask(taskId: string): Promise<void> {
		// Validate input
		validateTaskId(taskId);

		try {
			// First, query to get all sync metadata for this task
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					KeyConditionExpression: "taskId = :taskId",
					ExpressionAttributeValues: {
						":taskId": taskId,
					},
				}),
			);

			const items = result.Items as SyncMetadata[];
			if (!items || items.length === 0) {
				return; // No sync metadata to delete
			}

			// Delete each sync metadata record
			const deletePromises = items.map((item) =>
				this.client.send(
					new DeleteCommand({
						TableName: this.tableName,
						Key: {
							taskId: item.taskId,
							integrationId: item.integrationId,
						},
					}),
				),
			);

			await Promise.all(deletePromises);
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to delete sync metadata for task: ${error.message}`,
				);
			}
			throw new Error("Failed to delete sync metadata for task: Unknown error");
		}
	}

	/**
	 * Lists sync metadata by integration ID and status
	 */
	async listSyncMetadataByIntegrationAndStatus(
		integrationId: string,
		status: SyncStatus,
	): Promise<SyncMetadata[]> {
		// Validate inputs
		validateIntegrationId(integrationId);

		const validStatuses = ["pending", "synced", "conflict", "error"];
		if (!validStatuses.includes(status)) {
			throw new Error(`Status must be one of: ${validStatuses.join(", ")}`);
		}

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "integrationId-status-index",
					KeyConditionExpression:
						"integrationId = :integrationId AND syncStatus = :status",
					ExpressionAttributeValues: {
						":integrationId": integrationId,
						":status": status,
					},
				}),
			);

			return (result.Items as SyncMetadata[]) || [];
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to list sync metadata by integration and status: ${error.message}`,
				);
			}
			throw new Error(
				"Failed to list sync metadata by integration and status: Unknown error",
			);
		}
	}

	/**
	 * Lists all sync metadata for an integration
	 */
	async listSyncMetadataByIntegration(
		integrationId: string,
	): Promise<SyncMetadata[]> {
		// Validate input
		validateIntegrationId(integrationId);

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "integrationId-status-index",
					KeyConditionExpression: "integrationId = :integrationId",
					ExpressionAttributeValues: {
						":integrationId": integrationId,
					},
				}),
			);

			return (result.Items as SyncMetadata[]) || [];
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to list sync metadata by integration: ${error.message}`,
				);
			}
			throw new Error(
				"Failed to list sync metadata by integration: Unknown error",
			);
		}
	}
}
