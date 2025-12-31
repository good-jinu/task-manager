import {
	APIErrorCode,
	type Client,
	isFullPage,
	isNotionClientError,
} from "@notionhq/client";
import type {
	DatabaseObjectResponse,
	GetDatabaseResponse,
	PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { NotionAuthClient } from "./auth-client";
import type { NotionDatabase, NotionPage } from "./types";

export class NotionTaskManager {
	private authClient: NotionAuthClient | null = null;
	private client: Client | null = null;

	constructor(clientOrAuthClient: Client | NotionAuthClient) {
		if ("getClient" in clientOrAuthClient) {
			// It's a NotionAuthClient
			this.authClient = clientOrAuthClient;
		} else {
			// It's a regular Client
			this.client = clientOrAuthClient;
		}
	}

	/**
	 * Get the Notion client, handling token refresh if using auth client
	 */
	private async getClient(): Promise<Client> {
		if (this.authClient) {
			return await this.authClient.getClient();
		}
		if (this.client) {
			return this.client;
		}
		throw new Error("No Notion client available");
	}

	/**
	 * Get all databases accessible to the user
	 */
	async getDatabases(): Promise<NotionDatabase[]> {
		try {
			const client = await this.getClient();
			const response = await client.search({
				filter: {
					value: "database",
					property: "object",
				},
			});

			return response.results
				.filter((result) => result.object === "database")
				.filter((database) => this.hasRequiredDatabaseProperties(database))
				.map((database: DatabaseObjectResponse) =>
					this.mapNotionDatabaseToInterface(database),
				);
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to get databases: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Get all pages from a specific database
	 */
	async getDatabasePages(databaseId: string): Promise<NotionPage[]> {
		try {
			const client = await this.getClient();
			const response = await client.databases.query({
				database_id: databaseId,
			});

			return response.results
				.filter(isFullPage)
				.map((page: PageObjectResponse) => this.mapNotionPageToInterface(page));
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to get database pages: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Query database pages with a title filter
	 * Returns pages where the title contains the query string (case-insensitive)
	 */
	async queryDatabasePages(
		databaseId: string,
		titleQuery: string,
	): Promise<NotionPage[]> {
		try {
			const client = await this.getClient();
			const response = await client.databases.query({
				database_id: databaseId,
				filter: {
					property: "title",
					title: {
						contains: titleQuery,
					},
				},
			});

			return response.results
				.filter(isFullPage)
				.map((page: PageObjectResponse) => this.mapNotionPageToInterface(page));
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to query database pages: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Get all pages from a database (alias for getDatabasePages for consistency)
	 */
	async getAllDatabasePages(databaseId: string): Promise<NotionPage[]> {
		return this.getDatabasePages(databaseId);
	}

	/**
	 * Get a specific database by ID
	 */
	async getDatabase(databaseId: string): Promise<NotionDatabase | null> {
		try {
			const client = await this.getClient();
			const response: GetDatabaseResponse = await client.databases.retrieve({
				database_id: databaseId,
			});

			// Check if response has the necessary properties
			if (!this.hasRequiredDatabaseProperties(response)) {
				throw new Error(
					`Database response missing required properties: url, created_time, last_edited_time`,
				);
			}

			return this.mapNotionDatabaseToInterface(
				response as DatabaseObjectResponse,
			);
		} catch (error) {
			if (isNotionClientError(error)) {
				if (error.code === APIErrorCode.ObjectNotFound) {
					return null;
				}
				throw new Error(`Failed to get database: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Check if the database response has the required properties
	 */
	private hasRequiredDatabaseProperties(
		response: GetDatabaseResponse,
	): response is DatabaseObjectResponse {
		return (
			response &&
			typeof (response as DatabaseObjectResponse).url === "string" &&
			typeof (response as DatabaseObjectResponse).created_time === "string" &&
			typeof (response as DatabaseObjectResponse).last_edited_time ===
				"string" &&
			(response as DatabaseObjectResponse).title !== undefined
		);
	}

	/**
	 * Map a Notion database to our interface
	 */
	private mapNotionDatabaseToInterface(
		database: DatabaseObjectResponse,
	): NotionDatabase {
		const title = this.extractTitleFromDatabase(database);
		const description = this.extractDescriptionFromDatabase(database);

		return {
			id: database.id,
			title: title || "Untitled Database",
			description,
			url: database.url,
			createdTime: new Date(database.created_time),
			lastEditedTime: new Date(database.last_edited_time),
		};
	}

	/**
	 * Map a Notion page to our interface
	 */
	private mapNotionPageToInterface(page: PageObjectResponse): NotionPage {
		const title = this.extractTitleFromPage(page);

		return {
			id: page.id,
			title: title || "Untitled",
			properties: page.properties,
			url: page.url,
			createdTime: new Date(page.created_time),
			lastEditedTime: new Date(page.last_edited_time),
			archived: page.archived,
		};
	}

	private extractTitleFromDatabase(
		database: DatabaseObjectResponse,
	): string | undefined {
		if (
			database.title &&
			Array.isArray(database.title) &&
			database.title.length > 0
		) {
			return database.title[0]?.plain_text;
		}
		return undefined;
	}

	private extractDescriptionFromDatabase(
		database: DatabaseObjectResponse,
	): string | undefined {
		if (
			database.description &&
			Array.isArray(database.description) &&
			database.description.length > 0
		) {
			return database.description[0]?.plain_text;
		}
		return undefined;
	}

	private extractTitleFromPage(page: PageObjectResponse): string | undefined {
		const properties = page.properties;

		// Find the title property (it should be the first one or have type "title")
		for (const [, property] of Object.entries(properties)) {
			if (property && property.type === "title") {
				const titleProperty = property;
				if (
					Array.isArray(titleProperty.title) &&
					titleProperty.title.length > 0
				) {
					return titleProperty.title[0]?.plain_text;
				}
			}
		}

		return undefined;
	}
}
