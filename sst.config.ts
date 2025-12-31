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

		const searchHistoryTable = new sst.aws.Dynamo("SearchHistoryTable", {
			fields: {
				userId: "string", // Partition key (User ID)
				searchId: "string", // Sort key (Unique search request ID)
				createdAt: "string", // For GSI to query recent searches
			},
			primaryIndex: { hashKey: "userId", rangeKey: "searchId" },
			globalIndexes: {
				"createdAt-index": { hashKey: "userId", rangeKey: "createdAt" },
			},
		});

		// Domain configuration from environment variables
		const webDomain = process.env.WEB_DOMAIN;

		// SvelteKit application with environment variables and permissions
		const web = new sst.aws.SvelteKit("TaskManagerWeb", {
			path: "packages/web",
			domain: {
				name: webDomain ?? "",
			},
			link: [usersTable, databaseConfigsTable, searchHistoryTable],
			environment: {
				// Authentication
				AUTH_SECRET: process.env.AUTH_SECRET,
				AUTH_NOTION_ID: process.env.AUTH_NOTION_ID,
				AUTH_NOTION_SECRET: process.env.AUTH_NOTION_SECRET,
				AUTH_NOTION_REDIRECT_URI: process.env.AUTH_NOTION_REDIRECT_URI,

				// Database
				APP_AWS_REGION: process.env.APP_AWS_REGION || "us-east-1",

				// OpenAI Configuration
				OPENAI_API_KEY: process.env.OPENAI_API_KEY,
				OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
				OPENAI_NAME: process.env.OPENAI_NAME,
				OPENAI_MODEL: process.env.OPENAI_MODEL,

				// DeepInfra Configuration
				DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY,
				DEEPINFRA_MODEL: process.env.DEEPINFRA_MODEL,
			},
		});

		return {
			web: web.url,
			usersTable: usersTable.name,
			databaseConfigsTable: databaseConfigsTable.name,
			searchHistoryTable: searchHistoryTable.name,
		};
	},
});
