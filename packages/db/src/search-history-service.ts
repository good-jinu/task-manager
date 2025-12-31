import { randomUUID } from "node:crypto";
import {
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableNames } from "./client";

/**
 * Search query parameters stored with each search request
 */
export interface SearchQuery {
	description: string;
	databaseId: string;
	targetDate?: string;
	maxResults: number;
}

/**
 * Individual search result item
 */
export interface SearchResult {
	id: string;
	title: string;
	url: string;
	properties?: Record<string, unknown>;
}

/**
 * Search history record stored in DynamoDB
 */
export interface SearchHistoryRecord {
	userId: string; // Partition key
	searchId: string; // Sort key
	status: "pending" | "done" | "fail";
	query: SearchQuery;
	results?: SearchResult[];
	error?: string;
	createdAt: string;
	updatedAt: string;
	searchTime?: number; // Search duration in ms
	totalCount?: number; // Total pages searched
}

/**
 * Input for creating a new search
 */
export interface CreateSearchInput {
	description: string;
	databaseId: string;
	targetDate?: string;
	maxResults?: number;
}

/**
 * Data for updating search status to done
 */
export interface SearchDoneData {
	results: SearchResult[];
	searchTime?: number;
	totalCount?: number;
}

/**
 * Data for updating search status to fail
 */
export interface SearchFailData {
	error: string;
}

export class SearchHistoryService {
	private client = getDynamoDBClient();
	private tableName = getTableNames().searchHistory;

	/**
	 * Creates a new search record with pending status
	 */
	async createSearch(
		userId: string,
		input: CreateSearchInput,
	): Promise<SearchHistoryRecord> {
		if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
			throw new Error("User ID is required and cannot be empty");
		}

		if (
			!input.description ||
			typeof input.description !== "string" ||
			input.description.trim().length === 0
		) {
			throw new Error("Search description is required and cannot be empty");
		}

		if (
			!input.databaseId ||
			typeof input.databaseId !== "string" ||
			input.databaseId.trim().length === 0
		) {
			throw new Error("Database ID is required and cannot be empty");
		}

		const now = new Date().toISOString();
		const record: SearchHistoryRecord = {
			userId,
			searchId: randomUUID(),
			status: "pending",
			query: {
				description: input.description,
				databaseId: input.databaseId,
				targetDate: input.targetDate,
				maxResults: input.maxResults ?? 10,
			},
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
				throw new Error(`Failed to create search record: ${error.message}`);
			}
			throw new Error("Failed to create search record: Unknown error");
		}
	}

	/**
	 * Updates search status to done or fail with associated data
	 */
	async updateSearchStatus(
		userId: string,
		searchId: string,
		status: "done" | "fail",
		data: SearchDoneData | SearchFailData,
	): Promise<SearchHistoryRecord> {
		if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
			throw new Error("User ID is required and cannot be empty");
		}

		if (
			!searchId ||
			typeof searchId !== "string" ||
			searchId.trim().length === 0
		) {
			throw new Error("Search ID is required and cannot be empty");
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

		if (status === "done") {
			const doneData = data as SearchDoneData;
			updateExpressions.push("#results = :results");
			expressionAttributeNames["#results"] = "results";
			expressionAttributeValues[":results"] = doneData.results;

			if (doneData.searchTime !== undefined) {
				updateExpressions.push("#searchTime = :searchTime");
				expressionAttributeNames["#searchTime"] = "searchTime";
				expressionAttributeValues[":searchTime"] = doneData.searchTime;
			}

			if (doneData.totalCount !== undefined) {
				updateExpressions.push("#totalCount = :totalCount");
				expressionAttributeNames["#totalCount"] = "totalCount";
				expressionAttributeValues[":totalCount"] = doneData.totalCount;
			}
		} else if (status === "fail") {
			const failData = data as SearchFailData;
			updateExpressions.push("#error = :error");
			expressionAttributeNames["#error"] = "error";
			expressionAttributeValues[":error"] = failData.error;
		}

		try {
			const result = await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { userId, searchId },
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					ConditionExpression:
						"attribute_exists(userId) AND attribute_exists(searchId)",
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as SearchHistoryRecord;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "ConditionalCheckFailedException") {
					throw new Error(
						`Search record not found for user ${userId} and search ${searchId}`,
					);
				}
				throw new Error(`Failed to update search status: ${error.message}`);
			}
			throw new Error("Failed to update search status: Unknown error");
		}
	}

	/**
	 * Retrieves a specific search by user ID and search ID
	 */
	async getSearchById(
		userId: string,
		searchId: string,
	): Promise<SearchHistoryRecord | null> {
		if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
			throw new Error("User ID is required and cannot be empty");
		}

		if (
			!searchId ||
			typeof searchId !== "string" ||
			searchId.trim().length === 0
		) {
			throw new Error("Search ID is required and cannot be empty");
		}

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { userId, searchId },
				}),
			);

			return (result.Item as SearchHistoryRecord) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get search record: ${error.message}`);
			}
			throw new Error("Failed to get search record: Unknown error");
		}
	}

	/**
	 * Retrieves user's search history, sorted by createdAt descending
	 */
	async getUserSearchHistory(
		userId: string,
		limit = 20,
	): Promise<SearchHistoryRecord[]> {
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

			return (result.Items as SearchHistoryRecord[]) || [];
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get search history: ${error.message}`);
			}
			throw new Error("Failed to get search history: Unknown error");
		}
	}
}
