import { randomUUID } from "node:crypto";
import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableNames } from "./client";
import type {
	CreateIntegrationInput,
	ExternalIntegration,
	UpdateIntegrationInput,
} from "./types";
import {
	validateCreateIntegrationInput,
	validateIntegrationId,
	validateUpdateIntegrationInput,
	validateWorkspaceId,
} from "./validation";

export class IntegrationService {
	private client = getDynamoDBClient();
	private tableName = getTableNames().integrations;

	/**
	 * Creates a new integration in the database
	 */
	async createIntegration(
		workspaceId: string,
		integrationData: CreateIntegrationInput,
	): Promise<ExternalIntegration> {
		// Validate input data
		validateWorkspaceId(workspaceId);
		validateCreateIntegrationInput(integrationData);

		// Check if integration with same provider already exists for this workspace
		const existingIntegration = await this.getIntegrationByWorkspaceAndProvider(
			workspaceId,
			integrationData.provider,
		);

		if (existingIntegration) {
			throw new Error(
				`Integration with provider '${integrationData.provider}' already exists for this workspace`,
			);
		}

		const now = new Date().toISOString();
		const integration: ExternalIntegration = {
			id: randomUUID(),
			workspaceId,
			provider: integrationData.provider,
			externalId: integrationData.externalId,
			config: integrationData.config,
			syncEnabled: integrationData.syncEnabled ?? true,
			createdAt: now,
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
				throw new Error(`Failed to create integration: ${error.message}`);
			}
			throw new Error("Failed to create integration: Unknown error");
		}
	}

	/**
	 * Retrieves an integration by its ID
	 */
	async getIntegration(
		integrationId: string,
	): Promise<ExternalIntegration | null> {
		// Validate input
		validateIntegrationId(integrationId);

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { id: integrationId },
				}),
			);

			return (result.Item as ExternalIntegration) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get integration: ${error.message}`);
			}
			throw new Error("Failed to get integration: Unknown error");
		}
	}

	/**
	 * Retrieves an integration by workspace and provider
	 */
	async getIntegrationByWorkspaceAndProvider(
		workspaceId: string,
		provider: string,
	): Promise<ExternalIntegration | null> {
		// Validate input
		validateWorkspaceId(workspaceId);

		if (
			!provider ||
			typeof provider !== "string" ||
			provider.trim().length === 0
		) {
			throw new Error("Provider is required and cannot be empty");
		}

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "workspaceId-provider-index",
					KeyConditionExpression:
						"workspaceId = :workspaceId AND provider = :provider",
					ExpressionAttributeValues: {
						":workspaceId": workspaceId,
						":provider": provider,
					},
				}),
			);

			return (result.Items?.[0] as ExternalIntegration) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to get integration by workspace and provider: ${error.message}`,
				);
			}
			throw new Error(
				"Failed to get integration by workspace and provider: Unknown error",
			);
		}
	}

	/**
	 * Updates an existing integration
	 */
	async updateIntegration(
		integrationId: string,
		updates: UpdateIntegrationInput,
	): Promise<ExternalIntegration> {
		// Validate inputs
		validateIntegrationId(integrationId);
		validateUpdateIntegrationInput(updates);

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
					Key: { id: integrationId },
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					// Ensure the integration exists
					ConditionExpression: "attribute_exists(id)",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as ExternalIntegration;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(`Integration with ID ${integrationId} not found`);
				}
				throw new Error(`Failed to update integration: ${error.message}`);
			}
			throw new Error("Failed to update integration: Unknown error");
		}
	}

	/**
	 * Deletes an integration by its ID
	 */
	async deleteIntegration(integrationId: string): Promise<void> {
		// Validate input
		validateIntegrationId(integrationId);

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
					throw new Error(`Integration with ID ${integrationId} not found`);
				}
				throw new Error(`Failed to delete integration: ${error.message}`);
			}
			throw new Error("Failed to delete integration: Unknown error");
		}
	}

	/**
	 * Lists all integrations for a workspace
	 */
	async listIntegrations(workspaceId: string): Promise<ExternalIntegration[]> {
		// Validate input
		validateWorkspaceId(workspaceId);

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "workspaceId-provider-index",
					KeyConditionExpression: "workspaceId = :workspaceId",
					ExpressionAttributeValues: {
						":workspaceId": workspaceId,
					},
				}),
			);

			return (result.Items as ExternalIntegration[]) || [];
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to list integrations: ${error.message}`);
			}
			throw new Error("Failed to list integrations: Unknown error");
		}
	}
}
