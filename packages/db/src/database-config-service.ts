import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableNames } from "./client";
import { ValidationError } from "./validation";

export interface DatabaseConfig {
	userId: string;
	databaseId: string;
	title: string;
	description?: string;
	selectedAt: Date;
}

export interface CreateDatabaseConfigInput {
	databaseId: string;
	title: string;
	description?: string;
}

export class DatabaseConfigService {
	private client = getDynamoDBClient();
	private tableName = getTableNames().databaseConfigs;

	/**
	 * Save a database configuration for a user
	 */
	async saveDatabaseConfig(
		userId: string,
		input: CreateDatabaseConfigInput,
	): Promise<DatabaseConfig> {
		if (!userId || typeof userId !== "string") {
			throw new ValidationError("User ID is required");
		}

		if (!input.databaseId || typeof input.databaseId !== "string") {
			throw new ValidationError("Database ID is required");
		}

		if (!input.title || typeof input.title !== "string") {
			throw new ValidationError("Title is required");
		}

		const config: DatabaseConfig = {
			userId,
			databaseId: input.databaseId,
			title: input.title,
			description: input.description,
			selectedAt: new Date(),
		};

		const command = new PutCommand({
			TableName: this.tableName,
			Item: {
				...config,
				selectedAt: config.selectedAt.toISOString(),
			},
		});

		await this.client.send(command);
		return config;
	}

	/**
	 * Get all database configurations for a user
	 */
	async getDatabaseConfigs(userId: string): Promise<DatabaseConfig[]> {
		if (!userId || typeof userId !== "string") {
			throw new ValidationError("User ID is required");
		}

		const command = new QueryCommand({
			TableName: this.tableName,
			KeyConditionExpression: "userId = :userId",
			ExpressionAttributeValues: {
				":userId": userId,
			},
		});

		const response = await this.client.send(command);

		return (response.Items || []).map((item) => ({
			...item,
			selectedAt: new Date(item.selectedAt),
		})) as DatabaseConfig[];
	}

	/**
	 * Get a specific database configuration
	 */
	async getDatabaseConfig(
		userId: string,
		databaseId: string,
	): Promise<DatabaseConfig | null> {
		if (!userId || typeof userId !== "string") {
			throw new ValidationError("User ID is required");
		}

		if (!databaseId || typeof databaseId !== "string") {
			throw new ValidationError("Database ID is required");
		}

		const command = new GetCommand({
			TableName: this.tableName,
			Key: {
				userId,
				databaseId,
			},
		});

		const response = await this.client.send(command);

		if (!response.Item) {
			return null;
		}

		return {
			...response.Item,
			selectedAt: new Date(response.Item.selectedAt),
		} as DatabaseConfig;
	}

	/**
	 * Delete a database configuration
	 */
	async deleteDatabaseConfig(
		userId: string,
		databaseId: string,
	): Promise<void> {
		if (!userId || typeof userId !== "string") {
			throw new ValidationError("User ID is required");
		}

		if (!databaseId || typeof databaseId !== "string") {
			throw new ValidationError("Database ID is required");
		}

		const command = new DeleteCommand({
			TableName: this.tableName,
			Key: {
				userId,
				databaseId,
			},
		});

		await this.client.send(command);
	}
}
