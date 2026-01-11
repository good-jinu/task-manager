import { randomUUID } from "node:crypto";
import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableName } from "./client";
import type {
	CreateWorkspaceIntegrationInput,
	UpdateWorkspaceIntegrationInput,
	WorkspaceIntegration,
} from "./types";
import { validateWorkspaceId } from "./validation";

export class WorkspaceIntegrationService {
	private client = getDynamoDBClient();
	private get tableName() {
		return getTableName("workspaceIntegrations");
	}

	/**
	 * Creates a new workspace integration
	 */
	async create(
		integrationData: CreateWorkspaceIntegrationInput,
	): Promise<WorkspaceIntegration> {
		// Validate input data
		validateWorkspaceId(integrationData.workspaceId);

		if (!integrationData.provider) {
			throw new Error("Provider is required");
		}

		if (!integrationData.externalId) {
			throw new Error("External ID is required");
		}

		const now = new Date().toISOString();
		const integration: WorkspaceIntegration = {
			id: randomUUID(),
			workspaceId: integrationData.workspaceId,
			provider: integrationData.provider,
			externalId: integrationData.externalId,
			syncEnabled: integrationData.syncEnabled ?? true,
			config: integrationData.config || {},
			createdAt: now,
			updatedAt: now,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.tableName,
					Item: integration,
					// Prevent overwriting existing integrations
					ConditionExpression: "attribute_not_exists(id)",
				}),
			);

			return integration;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to create workspace integration: ${error.message}`,
				);
			}
			throw new Error("Failed to create workspace integration: Unknown error");
		}
	}

	/**
	 * Retrieves a workspace integration by its ID
	 */
	async getById(integrationId: string): Promise<WorkspaceIntegration | null> {
		if (!integrationId) {
			throw new Error("Integration ID is required");
		}

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { id: integrationId },
				}),
			);

			return (result.Item as WorkspaceIntegration) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to get workspace integration: ${error.message}`,
				);
			}
			throw new Error("Failed to get workspace integration: Unknown error");
		}
	}

	/**
	 * Lists all integrations for a workspace
	 */
	async listByWorkspace(workspaceId: string): Promise<WorkspaceIntegration[]> {
		validateWorkspaceId(workspaceId);

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "workspaceId-index",
					KeyConditionExpression: "workspaceId = :workspaceId",
					ExpressionAttributeValues: {
						":workspaceId": workspaceId,
					},
					ScanIndexForward: false, // Most recent first
				}),
			);

			return (result.Items as WorkspaceIntegration[]) || [];
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to list workspace integrations: ${error.message}`,
				);
			}
			throw new Error("Failed to list workspace integrations: Unknown error");
		}
	}

	/**
	 * Finds integration by workspace and provider
	 */
	async findByWorkspaceAndProvider(
		workspaceId: string,
		provider: string,
	): Promise<WorkspaceIntegration | null> {
		validateWorkspaceId(workspaceId);

		if (!provider) {
			throw new Error("Provider is required");
		}

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "workspaceId-index",
					KeyConditionExpression: "workspaceId = :workspaceId",
					FilterExpression: "#provider = :provider",
					ExpressionAttributeNames: {
						"#provider": "provider",
					},
					ExpressionAttributeValues: {
						":workspaceId": workspaceId,
						":provider": provider,
					},
				}),
			);

			const items = result.Items as WorkspaceIntegration[];
			return items.length > 0 ? items[0] : null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to find workspace integration: ${error.message}`,
				);
			}
			throw new Error("Failed to find workspace integration: Unknown error");
		}
	}

	/**
	 * Updates an existing workspace integration
	 */
	async update(
		integrationId: string,
		updates: UpdateWorkspaceIntegrationInput,
	): Promise<WorkspaceIntegration> {
		if (!integrationId) {
			throw new Error("Integration ID is required");
		}

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
					Key: { id: integrationId },
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					// Ensure the integration exists
					ConditionExpression: "attribute_exists(id)",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as WorkspaceIntegration;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Workspace integration with ID ${integrationId} not found`,
					);
				}
				throw new Error(
					`Failed to update workspace integration: ${error.message}`,
				);
			}
			throw new Error("Failed to update workspace integration: Unknown error");
		}
	}

	/**
	 * Deletes a workspace integration
	 */
	async delete(integrationId: string): Promise<void> {
		if (!integrationId) {
			throw new Error("Integration ID is required");
		}

		try {
			await this.client.send(
				new DeleteCommand({
					TableName: this.tableName,
					Key: { id: integrationId },
					// Ensure the integration exists before deleting
					ConditionExpression: "attribute_exists(id)",
				}),
			);
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Workspace integration with ID ${integrationId} not found`,
					);
				}
				throw new Error(
					`Failed to delete workspace integration: ${error.message}`,
				);
			}
			throw new Error("Failed to delete workspace integration: Unknown error");
		}
	}

	/**
	 * Updates sync status for an integration
	 */
	async updateSyncStatus(
		integrationId: string,
		success: boolean,
		error?: string,
	): Promise<WorkspaceIntegration> {
		const updates: UpdateWorkspaceIntegrationInput = {
			lastSyncAt: success ? new Date().toISOString() : undefined,
			lastError: error || undefined,
		};

		return this.update(integrationId, updates);
	}

	/**
	 * Toggles sync enabled status
	 */
	async toggleSync(
		integrationId: string,
		enabled: boolean,
	): Promise<WorkspaceIntegration> {
		return this.update(integrationId, { syncEnabled: enabled });
	}
}
