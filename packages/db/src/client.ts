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
 * Returns null if SST resources are not available (e.g., during build time)
 */
export function getTableNames() {
	try {
		return {
			// biome-ignore-start lint/suspicious/noExplicitAny: Resource for any
			users: (Resource as any).UsersTable?.name,
			databaseConfigs: (Resource as any).DatabaseConfigsTable?.name,
			agentExecutions: (Resource as any).AgentExecutionsTable?.name,
			tasks: (Resource as any).TasksTable?.name,
			workspaces: (Resource as any).WorkspacesTable?.name,
			integrations: (Resource as any).IntegrationsTable?.name,
			syncMetadata: (Resource as any).SyncMetadataTable?.name,
			guestUsers: (Resource as any).GuestUsersTable?.name,
			syncStatistics: (Resource as any).SyncStatisticsTable?.name,
			syncHistory: (Resource as any).SyncHistoryTable?.name,
			// biome-ignore-end lint/suspicious/noExplicitAny: Resource for any
		};
	} catch (_error) {
		// SST resources not available (e.g., during build time)
		return null;
	}
}

type TableNames = {
	users: string;
	databaseConfigs: string;
	agentExecutions: string;
	tasks: string;
	workspaces: string;
	integrations: string;
	syncMetadata: string;
	guestUsers: string;
	syncStatistics: string;
	syncHistory: string;
};

/**
 * Gets a specific table name, with fallback for build time
 */
export function getTableName(tableName: keyof TableNames): string {
	const tableNames = getTableNames();
	if (!tableNames || !tableNames[tableName]) {
		// Fallback for build time or missing resources - use environment variable or placeholder
		const envVarName = `${tableName.toUpperCase()}_TABLE_NAME`;
		const envValue = process.env[envVarName];
		if (envValue) {
			return envValue;
		}

		// If no environment variable, throw a more descriptive error
		throw new Error(
			`Table resource '${tableName}' not found. This might indicate:\n` +
				`1. The SST stack is not deployed yet\n` +
				`2. The table is not defined in sst.config.ts\n` +
				`3. The environment variable '${envVarName}' is not set\n` +
				`Please deploy the SST stack or check your configuration.`,
		);
	}
	return tableNames[tableName];
}
