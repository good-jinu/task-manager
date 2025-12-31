import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

/**
 * Creates and configures a DynamoDB client
 */
function createDynamoDBClient(): DynamoDBDocumentClient {
	// Create the base DynamoDB client
	const client = new DynamoDBClient({
		region: process.env.APP_AWS_REGION || "us-east-1",
	});

	// Create the document client for easier JSON handling
	const docClient = DynamoDBDocumentClient.from(client, {
		marshallOptions: {
			// Convert empty values to null
			convertEmptyValues: false,
			// Remove undefined values
			removeUndefinedValues: true,
			// Convert class instances to maps
			convertClassInstanceToMap: false,
		},
		unmarshallOptions: {
			// Return numbers as numbers instead of strings
			wrapNumbers: false,
		},
	});

	return docClient;
}

/**
 * Singleton DynamoDB client instance
 */
let dynamoClient: DynamoDBDocumentClient | null = null;

/**
 * Gets the DynamoDB client, creating it if it doesn't exist
 */
export function getDynamoDBClient(): DynamoDBDocumentClient {
	if (!dynamoClient) {
		dynamoClient = createDynamoDBClient();
	}
	return dynamoClient;
}

/**
 * Gets the table names from SST Resources
 */
export function getTableNames() {
	return {
		// biome-ignore-start lint/suspicious/noExplicitAny: Resource for any
		users: (Resource as any).UsersTable.name,
		databaseConfigs: (Resource as any).DatabaseConfigsTable.name,
		searchHistory: (Resource as any).SearchHistoryTable.name,
		// biome-ignore-end lint/suspicious/noExplicitAny: Resource for any
	};
}
