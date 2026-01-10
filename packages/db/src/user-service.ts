import { randomUUID } from "node:crypto";
import {
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableName } from "./client";
import type { CreateUserInput, UpdateUserInput, User } from "./types";
import {
	validateCreateUserInput,
	validateUpdateUserInput,
	validateUserId,
} from "./validation";

export class UserService {
	private client = getDynamoDBClient();
	private get tableName() {
		return getTableName("users");
	}

	/**
	 * Creates a new user in the database
	 */
	async createUser(userData: CreateUserInput): Promise<User> {
		// Validate input data
		validateCreateUserInput(userData);

		const now = new Date().toISOString();
		const user: User = {
			id: randomUUID(),
			...userData,
			createdAt: now,
			updatedAt: now,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.tableName,
					Item: user,
					// Prevent overwriting existing users
					ConditionExpression: "attribute_not_exists(id)",
				}),
			);

			return user;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to create user: ${error.message}`);
			}
			throw new Error("Failed to create user: Unknown error");
		}
	}

	/**
	 * Retrieves a user by their ID
	 */
	async getUserById(userId: string): Promise<User | null> {
		// Validate input
		validateUserId(userId);

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { id: userId },
				}),
			);

			return (result.Item as User) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get user: ${error.message}`);
			}
			throw new Error("Failed to get user: Unknown error");
		}
	}

	/**
	 * Retrieves a user by their Notion user ID
	 */
	async getUserByNotionId(notionUserId: string): Promise<User | null> {
		// Validate input
		if (
			!notionUserId ||
			typeof notionUserId !== "string" ||
			notionUserId.trim().length === 0
		) {
			throw new Error("Notion user ID is required and cannot be empty");
		}

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "notionUserId-index",
					KeyConditionExpression: "notionUserId = :notionUserId",
					ExpressionAttributeValues: {
						":notionUserId": notionUserId,
					},
				}),
			);

			return (result.Items?.[0] as User) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get user by Notion ID: ${error.message}`);
			}
			throw new Error("Failed to get user by Notion ID: Unknown error");
		}
	}

	/**
	 * Updates an existing user
	 */
	async updateUser(userId: string, updates: UpdateUserInput): Promise<User> {
		// Validate inputs
		validateUserId(userId);
		validateUpdateUserInput(updates);

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
					Key: { id: userId },
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					// Ensure the user exists
					ConditionExpression: "attribute_exists(id)",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as User;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(`User with ID ${userId} not found`);
				}
				throw new Error(`Failed to update user: ${error.message}`);
			}
			throw new Error("Failed to update user: Unknown error");
		}
	}
}
