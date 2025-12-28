import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getEnvironmentConfig } from "./config.js";

/**
 * Creates and configures a DynamoDB client
 */
function createDynamoDBClient(): DynamoDBDocumentClient {
	const config = getEnvironmentConfig();

	// Create the base DynamoDB client
	const client = new DynamoDBClient({
		region: config.AWS_REGION,
		// Additional configuration can be added here for different environments
		...(config.NODE_ENV === "development" &&
			{
				// Local development configuration if needed
				// endpoint: 'http://localhost:8000'
			}),
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
 * Gets the table names from environment configuration
 */
export function getTableNames() {
	const config = getEnvironmentConfig();
	return {
		users: config.DYNAMODB_USERS_TABLE,
		tasks: config.DYNAMODB_TASKS_TABLE,
	};
}
