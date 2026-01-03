import {
	APIErrorCode,
	type Client,
	isFullPage,
	isNotionClientError,
} from "@notionhq/client";
import type {
	BlockObjectResponse,
	DatabaseObjectResponse,
	GetDatabaseResponse,
	PageObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { NotionAuthClient } from "./auth-client";
import type { NotionDatabase, NotionPage, PageProperties } from "./types";

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
	 * Create a new page in a Notion database
	 * @param databaseId - The ID of the database to create the page in
	 * @param properties - The properties for the new page (must include title, optionally content)
	 * @returns The created NotionPage
	 */
	async createPage(
		databaseId: string,
		properties: PageProperties,
	): Promise<NotionPage> {
		try {
			const client = await this.getClient();

			// Build the properties object for the Notion API
			// The title property is handled specially as a rich text array
			const notionProperties: Record<
				string,
				{ title: Array<{ text: { content: string } }> }
			> = {
				title: {
					title: [
						{
							text: {
								content: properties.title,
							},
						},
					],
				},
			};

			// Build the content blocks if content is provided
			const children = properties.content
				? properties.content
						.split("\n")
						.filter((p) => p.trim() !== "")
						.map((paragraph) => ({
							object: "block" as const,
							type: "paragraph" as const,
							paragraph: {
								rich_text: [
									{
										type: "text" as const,
										text: {
											content: paragraph,
										},
									},
								],
							},
						}))
				: [];

			const response = await client.pages.create({
				parent: {
					database_id: databaseId,
				},
				properties: notionProperties as Parameters<
					typeof client.pages.create
				>[0]["properties"],
				...(children.length > 0 && { children }),
			});

			if (!isFullPage(response)) {
				throw new Error("Failed to create page: incomplete response");
			}

			return this.mapNotionPageToInterface(response);
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to create page: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Update an existing Notion page
	 * @param pageId - The ID of the page to update
	 * @param properties - The properties to update (partial update supported)
	 * @returns The updated NotionPage
	 */
	async updatePage(
		pageId: string,
		properties: Partial<PageProperties>,
	): Promise<NotionPage> {
		try {
			const client = await this.getClient();

			// Build the properties object for the Notion API
			const notionProperties: Record<
				string,
				{ title: Array<{ text: { content: string } }> }
			> = {};

			// Handle title property specially
			if (properties.title !== undefined) {
				notionProperties.title = {
					title: [
						{
							text: {
								content: properties.title,
							},
						},
					],
				};
			}

			const response = await client.pages.update({
				page_id: pageId,
				properties: notionProperties as Parameters<
					typeof client.pages.update
				>[0]["properties"],
			});

			if (!isFullPage(response)) {
				throw new Error("Failed to update page: incomplete response");
			}

			// If content is provided, update the page content separately
			if (properties.content !== undefined) {
				await this.updatePageContent(pageId, properties.content);
			}

			return this.mapNotionPageToInterface(response);
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to update page: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Update the content (blocks) of an existing Notion page
	 * This replaces all existing content with the new content
	 * @param pageId - The ID of the page to update
	 * @param content - The new content as a string (will be converted to paragraph blocks)
	 * @returns The updated NotionPage
	 */
	async updatePageContent(
		pageId: string,
		content: string,
	): Promise<NotionPage> {
		try {
			const client = await this.getClient();

			// First, get all existing blocks in the page
			const existingBlocks = await client.blocks.children.list({
				block_id: pageId,
			});

			// Delete all existing blocks
			for (const block of existingBlocks.results) {
				if ("id" in block) {
					await client.blocks.delete({
						block_id: block.id,
					});
				}
			}

			// Split content into paragraphs and create blocks
			const paragraphs = content.split("\n").filter((p) => p.trim() !== "");
			const blocks = paragraphs.map((paragraph) => ({
				object: "block" as const,
				type: "paragraph" as const,
				paragraph: {
					rich_text: [
						{
							type: "text" as const,
							text: {
								content: paragraph,
							},
						},
					],
				},
			}));

			// Add new blocks to the page
			if (blocks.length > 0) {
				await client.blocks.children.append({
					block_id: pageId,
					children: blocks,
				});
			}

			// Get the updated page to return
			const response = await client.pages.retrieve({
				page_id: pageId,
			});

			if (!isFullPage(response)) {
				throw new Error("Failed to retrieve updated page: incomplete response");
			}

			return this.mapNotionPageToInterface(response);
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to update page content: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Get the text content of a Notion page by retrieving its child blocks
	 * @param pageId - The ID of the page to get content from
	 * @returns The text content of the page as a string
	 */
	async getPageContent(pageId: string): Promise<string> {
		try {
			const client = await this.getClient();
			const response = await client.blocks.children.list({
				block_id: pageId,
			});

			const contentParts: string[] = [];

			for (const block of response.results) {
				if ("type" in block) {
					const textContent = this.extractTextFromBlock(block);
					if (textContent) {
						contentParts.push(textContent);
					}
				}
			}

			return contentParts.join("\n");
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to get page content: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Extract text content from a Notion block
	 * @param block - The block to extract text from
	 * @returns The text content of the block
	 */
	private extractTextFromBlock(block: BlockObjectResponse): string {
		if (!block.type) return "";

		const blockType = block.type;
		let blockData: {
			rich_text?: RichTextItemResponse[] | RichTextItemResponse;
			expression?: string;
			title?: string;
		} = {};
		if (blockType in block) {
			blockData = block[blockType];
		}

		// Handle blocks that have rich_text property
		if (blockData?.rich_text && Array.isArray(blockData.rich_text)) {
			return blockData.rich_text
				.map((richText: RichTextItemResponse) => richText.plain_text || "")
				.join("");
		}

		// Handle specific block types
		switch (blockType) {
			case "paragraph":
			case "heading_1":
			case "heading_2":
			case "heading_3":
			case "bulleted_list_item":
			case "numbered_list_item":
			case "quote":
			case "callout":
			case "toggle":
				return (
					blockData?.rich_text
						?.map((richText: RichTextItemResponse) => richText.plain_text || "")
						.join("") || ""
				);

			case "to_do": {
				const todoText =
					blockData?.rich_text
						?.map((richText: RichTextItemResponse) => richText.plain_text || "")
						.join("") || "";
				const checked = blockData?.checked ? "[x]" : "[ ]";
				return `${checked} ${todoText}`;
			}

			case "code":
				return (
					blockData?.rich_text
						?.map((richText: RichTextItemResponse) => richText.plain_text || "")
						.join("") || ""
				);

			case "equation":
				return blockData?.expression || "";

			case "child_page":
				return blockData?.title || "";

			case "child_database":
				return blockData?.title || "";

			default:
				return "";
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
