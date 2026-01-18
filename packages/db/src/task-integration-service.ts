import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getTableName } from "./client";
import type {
	CreateTaskIntegrationInput,
	TaskIntegration,
	UpdateTaskIntegrationInput,
} from "./types";
import { ValidationError } from "./validation";

/**
 * Service for managing task integrations with external services
 */
export class TaskIntegrationService {
	private client: DynamoDBDocumentClient;
	private tableName: string;

	constructor(client?: DynamoDBClient) {
		this.client = DynamoDBDocumentClient.from(
			client || new DynamoDBClient({ region: process.env.AWS_REGION }),
		);
		this.tableName = getTableName("taskIntegrations");
	}

	/**
	 * Create a new task integration
	 */
	async create(
		taskId: string,
		input: CreateTaskIntegrationInput,
	): Promise<TaskIntegration> {
		console.log("[TaskIntegrationService.create] Creating integration:", {
			taskId,
			provider: input.provider,
			externalId: input.externalId,
		});

		if (!taskId?.trim()) {
			throw new ValidationError("Task ID is required");
		}
		if (!input.provider?.trim()) {
			throw new ValidationError("Provider is required");
		}
		if (!input.externalId?.trim()) {
			throw new ValidationError("External ID is required");
		}

		const now = new Date().toISOString();
		const integration: TaskIntegration = {
			taskId: taskId.trim(),
			provider: input.provider.trim(),
			externalId: input.externalId.trim(),
			createdAt: now,
			updatedAt: now,
		};

		await this.client.send(
			new PutCommand({
				TableName: this.tableName,
				Item: integration,
				ConditionExpression: "attribute_not_exists(taskId)",
			}),
		);

		console.log(
			"[TaskIntegrationService.create] Integration created successfully:",
			{
				taskId: integration.taskId,
				provider: integration.provider,
			},
		);

		return integration;
	}

	/**
	 * Get task integration by task ID
	 */
	async getByTaskId(taskId: string): Promise<TaskIntegration | null> {
		console.log("[TaskIntegrationService.getByTaskId] Fetching integration:", {
			taskId,
		});

		if (!taskId?.trim()) {
			throw new ValidationError("Task ID is required");
		}

		const result = await this.client.send(
			new GetCommand({
				TableName: this.tableName,
				Key: { taskId: taskId.trim() },
			}),
		);

		const integration = (result.Item as TaskIntegration) || null;
		console.log("[TaskIntegrationService.getByTaskId] Integration fetched:", {
			taskId,
			found: !!integration,
			provider: integration?.provider,
			externalId: integration?.externalId,
		});

		return integration;
	}

	/**
	 * Get task integration by external ID
	 */
	async getByExternalId(externalId: string): Promise<TaskIntegration | null> {
		console.log(
			"[TaskIntegrationService.getByExternalId] Fetching integration:",
			{ externalId },
		);

		if (!externalId?.trim()) {
			throw new ValidationError("External ID is required");
		}

		const result = await this.client.send(
			new QueryCommand({
				TableName: this.tableName,
				IndexName: "externalId-index",
				KeyConditionExpression: "externalId = :externalId",
				ExpressionAttributeValues: {
					":externalId": externalId.trim(),
				},
				Limit: 1,
			}),
		);

		const integration = (result.Items?.[0] as TaskIntegration) || null;
		console.log(
			"[TaskIntegrationService.getByExternalId] Integration fetched:",
			{
				externalId,
				found: !!integration,
				taskId: integration?.taskId,
				provider: integration?.provider,
			},
		);

		return integration;
	}

	/**
	 * Get task integration by provider and external ID
	 */
	async getByProviderAndExternalId(
		provider: string,
		externalId: string,
	): Promise<TaskIntegration | null> {
		if (!provider?.trim()) {
			throw new ValidationError("Provider is required");
		}
		if (!externalId?.trim()) {
			throw new ValidationError("External ID is required");
		}

		const result = await this.client.send(
			new QueryCommand({
				TableName: this.tableName,
				IndexName: "provider-externalId-index",
				KeyConditionExpression:
					"provider = :provider AND externalId = :externalId",
				ExpressionAttributeValues: {
					":provider": provider.trim(),
					":externalId": externalId.trim(),
				},
				Limit: 1,
			}),
		);

		return (result.Items?.[0] as TaskIntegration) || null;
	}

	/**
	 * Update task integration
	 */
	async update(
		taskId: string,
		input: UpdateTaskIntegrationInput,
	): Promise<TaskIntegration> {
		if (!taskId?.trim()) {
			throw new ValidationError("Task ID is required");
		}

		const updateExpressions: string[] = [];
		const expressionAttributeNames: Record<string, string> = {};
		const expressionAttributeValues: Record<string, unknown> = {};

		if (input.provider?.trim()) {
			updateExpressions.push("#provider = :provider");
			expressionAttributeNames["#provider"] = "provider";
			expressionAttributeValues[":provider"] = input.provider.trim();
		}

		if (input.externalId?.trim()) {
			updateExpressions.push("externalId = :externalId");
			expressionAttributeValues[":externalId"] = input.externalId.trim();
		}

		if (updateExpressions.length === 0) {
			throw new ValidationError(
				"At least one field must be provided for update",
			);
		}

		// Always update the updatedAt timestamp
		updateExpressions.push("updatedAt = :updatedAt");
		expressionAttributeValues[":updatedAt"] = new Date().toISOString();

		const result = await this.client.send(
			new UpdateCommand({
				TableName: this.tableName,
				Key: { taskId: taskId.trim() },
				UpdateExpression: `SET ${updateExpressions.join(", ")}`,
				ExpressionAttributeNames:
					Object.keys(expressionAttributeNames).length > 0
						? expressionAttributeNames
						: undefined,
				ExpressionAttributeValues: expressionAttributeValues,
				ConditionExpression: "attribute_exists(taskId)",
				ReturnValues: "ALL_NEW",
			}),
		);

		return result.Attributes as TaskIntegration;
	}

	/**
	 * Delete task integration
	 */
	async delete(taskId: string): Promise<void> {
		if (!taskId?.trim()) {
			throw new ValidationError("Task ID is required");
		}

		await this.client.send(
			new DeleteCommand({
				TableName: this.tableName,
				Key: { taskId: taskId.trim() },
				ConditionExpression: "attribute_exists(taskId)",
			}),
		);
	}

	/**
	 * Check if task has integration
	 */
	async hasIntegration(taskId: string): Promise<boolean> {
		const integration = await this.getByTaskId(taskId);
		return integration !== null;
	}
}
