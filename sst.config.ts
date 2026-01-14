/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	app(input) {
		return {
			name: "task-manager",
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

		const guestUsersTable = new sst.aws.Dynamo("GuestUsersTable", {
			fields: {
				id: "string", // Primary key (Generated guest ID)
			},
			primaryIndex: { hashKey: "id" },
			ttl: "expiresAt", // Enable TTL on expiresAt field
		});

		const taskIntegrationsTable = new sst.aws.Dynamo("TaskIntegrationsTable", {
			fields: {
				taskId: "string", // Primary key (Internal task ID)
				provider: "string", // External service provider (notion, etc.)
				externalId: "string", // External task/page ID
			},
			primaryIndex: { hashKey: "taskId" },
			globalIndexes: {
				"externalId-index": { hashKey: "externalId" },
				"provider-externalId-index": {
					hashKey: "provider",
					rangeKey: "externalId",
				},
			},
		});

		const workspaceIntegrationsTable = new sst.aws.Dynamo(
			"WorkspaceIntegrationsTable",
			{
				fields: {
					id: "string", // Primary key (UUID)
					workspaceId: "string", // Workspace this integration belongs to
					provider: "string", // External service provider (notion, etc.)
					createdAt: "string", // For sorting by creation time
				},
				primaryIndex: { hashKey: "id" },
				globalIndexes: {
					"workspaceId-index": {
						hashKey: "workspaceId",
						rangeKey: "createdAt",
					},
					"workspaceId-provider-index": {
						hashKey: "workspaceId",
						rangeKey: "provider",
					},
				},
			},
		);

		// Domain configuration from environment variables
		const webDomain = process.env.WEB_DOMAIN;

		// SvelteKit application with environment variables and permissions
		const web = new sst.aws.SvelteKit("TaskManagerWeb", {
			path: "packages/web",
			...(webDomain ? { domain: { name: webDomain } } : {}),
			link: [
				usersTable,
				agentExecutionsTable,
				tasksTable,
				workspacesTable,
				guestUsersTable,
				taskIntegrationsTable,
				workspaceIntegrationsTable,
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
			agentExecutionsTable: agentExecutionsTable.name,
			tasksTable: tasksTable.name,
			workspacesTable: workspacesTable.name,
			guestUsersTable: guestUsersTable.name,
			taskIntegrationsTable: taskIntegrationsTable.name,
			workspaceIntegrationsTable: workspaceIntegrationsTable.name,
		};
	},
});
