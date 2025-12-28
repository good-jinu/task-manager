import { Client, LogLevel } from "@notionhq/client";

export interface NotionClientConfig {
	auth: string;
	logLevel?: LogLevel;
}

export class NotionTaskClient {
	private client: Client;

	constructor(config: NotionClientConfig) {
		this.client = new Client({
			auth: config.auth,
			logLevel: config.logLevel || LogLevel.WARN,
		});
	}

	/**
	 * Get the underlying Notion client for direct API access
	 */
	getClient(): Client {
		return this.client;
	}

	/**
	 * Test the connection to Notion API
	 */
	async testConnection(): Promise<boolean> {
		try {
			await this.client.users.me({});
			return true;
		} catch (error) {
			console.error("Failed to connect to Notion:", error);
			return false;
		}
	}
}
