import { randomUUID } from "node:crypto";
import {
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ExecutionStep } from "@task-manager/core";
import { getDynamoDBClient, getTableName } from "./client";

/**
 * Status of an agent execution
 */
export type ExecutionStatus = "pending" | "done" | "fail";

/**
 * Individual step taken by the agent during execution
 * Re-export from core for backward compatibility
 */
export type { ExecutionStep } from "@task-manager/core";

/**
 * Result of a completed agent execution
 */
export interface AgentExecutionResult {
	action: "created" | "updated" | "none";
	pageId?: string;
	pageTitle?: string;
	pageUrl?: string;
	reasoning: string;
}

/**
 * Agent execution record stored in DynamoDB
 */
export interface AgentExecutionRecord {
	userId: string; // Partition key
	executionId: string; // Sort key
	status: ExecutionStatus;
	query: string;
	databaseId: string;
	steps: ExecutionStep[];
	result?: AgentExecutionResult;
	error?: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Input for creating a new execution
 */
export interface CreateExecutionInput {
	query: string;
	databaseId: string;
}

/**
 * Data for updating execution status
 */
export interface ExecutionUpdateData {
	result?: AgentExecutionResult;
	error?: string;
}

export class AgentExecutionService {
	private client = getDynamoDBClient();
	private get tableName() {
		return getTableName("agentExecutions");
	}

	/**
	 * Creates a new execution record with pending status
	 */
	async createExecution(
		userId: string,
		input: CreateExecutionInput,
	): Promise<AgentExecutionRecord> {
		if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
			throw new Error("User ID is required and cannot be empty");
		}

		if (
			!input.query ||
			typeof input.query !== "string" ||
			input.query.trim().length === 0
		) {
			throw new Error("Query is required and cannot be empty");
		}

		if (
			!input.databaseId ||
			typeof input.databaseId !== "string" ||
			input.databaseId.trim().length === 0
		) {
			throw new Error("Database ID is required and cannot be empty");
		}

		const now = new Date().toISOString();
		const record: AgentExecutionRecord = {
			userId,
			executionId: randomUUID(),
			status: "pending",
			query: input.query,
			databaseId: input.databaseId,
			steps: [],
			createdAt: now,
			updatedAt: now,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.tableName,
					Item: record,
				}),
			);

			return record;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to create execution record: ${error.message}`);
			}
			throw new Error("Failed to create execution record: Unknown error");
		}
	}

	/**
	 * Updates execution status to done or fail with associated data
	 */
	async updateExecutionStatus(
		userId: string,
		executionId: string,
		status: "done" | "fail",
		data: ExecutionUpdateData,
	): Promise<AgentExecutionRecord> {
		if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
			throw new Error("User ID is required and cannot be empty");
		}

		if (
			!executionId ||
			typeof executionId !== "string" ||
			executionId.trim().length === 0
		) {
			throw new Error("Execution ID is required and cannot be empty");
		}

		const now = new Date().toISOString();
		const updateExpressions: string[] = [
			"#status = :status",
			"#updatedAt = :updatedAt",
		];
		const expressionAttributeNames: Record<string, string> = {
			"#status": "status",
			"#updatedAt": "updatedAt",
		};
		const expressionAttributeValues: Record<string, unknown> = {
			":status": status,
			":updatedAt": now,
		};

		if (status === "done" && data.result) {
			updateExpressions.push("#result = :result");
			expressionAttributeNames["#result"] = "result";
			expressionAttributeValues[":result"] = data.result;
		}

		if (status === "fail" && data.error) {
			updateExpressions.push("#error = :error");
			expressionAttributeNames["#error"] = "error";
			expressionAttributeValues[":error"] = data.error;
		}

		try {
			const result = await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { userId, executionId },
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					ConditionExpression:
						"attribute_exists(userId) AND attribute_exists(executionId)",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as AgentExecutionRecord;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Execution record not found for user ${userId} and execution ${executionId}`,
					);
				}
				throw new Error(`Failed to update execution status: ${error.message}`);
			}
			throw new Error("Failed to update execution status: Unknown error");
		}
	}

	/**
	 * Adds a step to an existing execution record
	 */
	async addExecutionStep(
		userId: string,
		executionId: string,
		step: ExecutionStep,
	): Promise<void> {
		if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
			throw new Error("User ID is required and cannot be empty");
		}

		if (
			!executionId ||
			typeof executionId !== "string" ||
			executionId.trim().length === 0
		) {
			throw new Error("Execution ID is required and cannot be empty");
		}

		if (!step || !step.stepId || !step.toolName || !step.timestamp) {
			throw new Error("Step must have stepId, toolName, and timestamp");
		}

		const now = new Date().toISOString();

		try {
			await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { userId, executionId },
					UpdateExpression:
						"SET #steps = list_append(if_not_exists(#steps, :emptyList), :step), #updatedAt = :updatedAt",
					ExpressionAttributeNames: {
						"#steps": "steps",
						"#updatedAt": "updatedAt",
					},
					ExpressionAttributeValues: {
						":step": [step],
						":emptyList": [],
						":updatedAt": now,
					},
					ConditionExpression:
						"attribute_exists(userId) AND attribute_exists(executionId)",
				}),
			);
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Execution record not found for user ${userId} and execution ${executionId}`,
					);
				}
				throw new Error(`Failed to add execution step: ${error.message}`);
			}
			throw new Error("Failed to add execution step: Unknown error");
		}
	}

	/**
	 * Retrieves a specific execution by user ID and execution ID
	 */
	async getExecutionById(
		userId: string,
		executionId: string,
	): Promise<AgentExecutionRecord | null> {
		if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
			throw new Error("User ID is required and cannot be empty");
		}

		if (
			!executionId ||
			typeof executionId !== "string" ||
			executionId.trim().length === 0
		) {
			throw new Error("Execution ID is required and cannot be empty");
		}

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { userId, executionId },
				}),
			);

			return (result.Item as AgentExecutionRecord) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get execution record: ${error.message}`);
			}
			throw new Error("Failed to get execution record: Unknown error");
		}
	}

	/**
	 * Retrieves user's execution history, sorted by createdAt descending
	 */
	async getUserExecutions(
		userId: string,
		limit = 20,
	): Promise<AgentExecutionRecord[]> {
		if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
			throw new Error("User ID is required and cannot be empty");
		}

		try {
			const result = await this.client.send(
				new QueryCommand({
					TableName: this.tableName,
					IndexName: "createdAt-index",
					KeyConditionExpression: "userId = :userId",
					ExpressionAttributeValues: {
						":userId": userId,
					},
					ScanIndexForward: false, // Sort descending by createdAt
					Limit: limit,
				}),
			);

			return (result.Items as AgentExecutionRecord[]) || [];
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get execution history: ${error.message}`);
			}
			throw new Error("Failed to get execution history: Unknown error");
		}
	}
}
