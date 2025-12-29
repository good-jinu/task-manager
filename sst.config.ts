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

		const tasksTable = new sst.aws.Dynamo("TasksTable", {
			fields: {
				userId: "string", // Partition key (User ID)
				id: "string", // Sort key (Task UUID)
				status: "string", // For GSI
				createdAt: "string", // For GSI sorting
			},
			primaryIndex: { hashKey: "userId", rangeKey: "id" },
			globalIndexes: {
				"status-createdAt-index": { hashKey: "status", rangeKey: "createdAt" },
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
			link: [usersTable, tasksTable],
			environment: {
				// Authentication
				AUTH_SECRET: process.env.AUTH_SECRET,
				AUTH_NOTION_ID: process.env.AUTH_NOTION_ID,
				AUTH_NOTION_SECRET: process.env.AUTH_NOTION_SECRET,
				AUTH_NOTION_REDIRECT_URI: process.env.AUTH_NOTION_REDIRECT_URI,

				// Database
				APP_AWS_REGION: process.env.APP_AWS_REGION || "us-east-1",
			},
		});

		return {
			web: web.url,
			usersTable: usersTable.name,
			tasksTable: tasksTable.name,
		};
	},
});
