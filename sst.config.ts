/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	app(input) {
		return {
			name: "notion-task-manager",
			removal: input?.stage === "production" ? "retain" : "remove",
			protect: ["production"].includes(input?.stage),
			home: "aws",
		};
	},
	async run() {
		// DynamoDB Tables
		const usersTable = new sst.aws.Dynamo("UsersTable", {
			fields: {
				id: "string", // Primary key (UUID)
				notionUserId: "string", // GSI for OAuth lookups
			},
			primaryIndex: { hashKey: "id" },
			globalIndexes: {
				"notionUserId-index": { hashKey: "notionUserId" },
			},
		});

		const databaseConfigsTable = new sst.aws.Dynamo("DatabaseConfigsTable", {
			fields: {
				userId: "string", // Partition key (User ID)
				databaseId: "string", // Sort key (Notion Database ID)
			},
			primaryIndex: { hashKey: "userId", rangeKey: "databaseId" },
		});

		const agentExecutionsTable = new sst.aws.Dynamo("AgentExecutionsTable", {
			fields: {
				userId: "string", // Partition key (User ID)
				executionId: "string", // Sort key (Unique execution ID)
				createdAt: "string", // For GSI to query execution history
			},
			primaryIndex: { hashKey: "userId", rangeKey: "executionId" },
			globalIndexes: {
				"createdAt-index": { hashKey: "userId", rangeKey: "createdAt" },
			},
		});

		// New tables for task management migration
		const tasksTable = new sst.aws.Dynamo("TasksTable", {
			fields: {
				id: "string", // Primary key (UUID)
				workspaceId: "string", // Foreign key to workspace
				status: "string", // Task status for filtering
				createdAt: "string", // For sorting by creation time
			},
			primaryIndex: { hashKey: "id" },
			globalIndexes: {
				"workspaceId-index": { hashKey: "workspaceId", rangeKey: "createdAt" },
				"workspaceId-status-index": {
					hashKey: "workspaceId",
					rangeKey: "status",
				},
			},
		});

		const workspacesTable = new sst.aws.Dynamo("WorkspacesTable", {
			fields: {
				id: "string", // Primary key (UUID)
				userId: "string", // Owner user ID
				createdAt: "string", // For sorting by creation time
			},
			primaryIndex: { hashKey: "id" },
			globalIndexes: {
				"userId-index": { hashKey: "userId", rangeKey: "createdAt" },
			},
		});

		const integrationsTable = new sst.aws.Dynamo("IntegrationsTable", {
			fields: {
				id: "string", // Primary key (UUID)
				workspaceId: "string", // Foreign key to workspace
				provider: "string", // Integration provider (notion, etc.)
			},
			primaryIndex: { hashKey: "id" },
			globalIndexes: {
				"workspaceId-provider-index": {
					hashKey: "workspaceId",
					rangeKey: "provider",
				},
			},
		});

		const syncMetadataTable = new sst.aws.Dynamo("SyncMetadataTable", {
			fields: {
				taskId: "string", // Partition key (Foreign key to task)
				integrationId: "string", // Sort key (Foreign key to integration)
				syncStatus: "string", // For filtering by sync status
				externalId: "string", // External task/page ID for reverse lookup
			},
			primaryIndex: { hashKey: "taskId", rangeKey: "integrationId" },
			globalIndexes: {
				"integrationId-status-index": {
					hashKey: "integrationId",
					rangeKey: "syncStatus",
				},
				"externalId-index": { hashKey: "externalId" },
			},
		});

		const guestUsersTable = new sst.aws.Dynamo("GuestUsersTable", {
			fields: {
				id: "string", // Primary key (Generated guest ID)
			},
			primaryIndex: { hashKey: "id" },
			ttl: "expiresAt", // Enable TTL on expiresAt field
		});

		const syncStatisticsTable = new sst.aws.Dynamo("SyncStatisticsTable", {
			fields: {
				integrationId: "string", // Primary key (Foreign key to integration)
			},
			primaryIndex: { hashKey: "integrationId" },
		});

		const syncHistoryTable = new sst.aws.Dynamo("SyncHistoryTable", {
			fields: {
				id: "string", // Primary key (UUID)
				integrationId: "string", // Foreign key to integration
				createdAt: "string", // For sorting by creation time
			},
			primaryIndex: { hashKey: "id" },
			globalIndexes: {
				"integrationId-index": {
					hashKey: "integrationId",
					rangeKey: "createdAt",
				},
			},
		});

		// Domain configuration from environment variables
		const webDomain = process.env.WEB_DOMAIN;

		// SvelteKit application with environment variables and permissions
		const web = new sst.aws.SvelteKit("TaskManagerWeb", {
			path: "packages/web",
			...(webDomain ? { domain: { name: webDomain } } : {}),
			link: [
				usersTable,
				databaseConfigsTable,
				agentExecutionsTable,
				tasksTable,
				workspacesTable,
				integrationsTable,
				syncMetadataTable,
				guestUsersTable,
				syncStatisticsTable,
				syncHistoryTable,
			],
			environment: {
				// Authentication
				AUTH_SECRET: process.env.AUTH_SECRET ?? "",
				AUTH_NOTION_ID: process.env.AUTH_NOTION_ID ?? "",
				AUTH_NOTION_SECRET: process.env.AUTH_NOTION_SECRET ?? "",
				AUTH_NOTION_REDIRECT_URI: process.env.AUTH_NOTION_REDIRECT_URI ?? "",

				// Database
				APP_AWS_REGION: process.env.APP_AWS_REGION ?? "us-east-1",

				// OpenAI Configuration
				OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
				OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? "",
				OPENAI_NAME: process.env.OPENAI_NAME ?? "",
				OPENAI_MODEL: process.env.OPENAI_MODEL ?? "",

				// DeepInfra Configuration
				DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY ?? "",
				DEEPINFRA_MODEL: process.env.DEEPINFRA_MODEL ?? "",
			},
			server: {
				runtime: "nodejs22.x",
			},
		});

		return {
			web: web.url,
			usersTable: usersTable.name,
			databaseConfigsTable: databaseConfigsTable.name,
			agentExecutionsTable: agentExecutionsTable.name,
			tasksTable: tasksTable.name,
			workspacesTable: workspacesTable.name,
			integrationsTable: integrationsTable.name,
			syncMetadataTable: syncMetadataTable.name,
			guestUsersTable: guestUsersTable.name,
			syncStatisticsTable: syncStatisticsTable.name,
			syncHistoryTable: syncHistoryTable.name,
		};
	},
});
