import {
	APIErrorCode,
	type Client,
	isFullPage,
	isNotionClientError,
} from "@notionhq/client";
import type {
	BlockObjectRequest,
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
	 * Update an existing Notion page with title and markdown content
	 * @param pageId - The ID of the page to update
	 * @param title - The new title for the page (optional)
	 * @param content - The new content as markdown (optional)
	 * @returns The updated NotionPage
	 */
	async updatePageWithMarkdown(
		pageId: string,
		title?: string,
		content?: string,
	): Promise<NotionPage> {
		try {
			const client = await this.getClient();

			// Update title if provided
			if (title !== undefined) {
				const notionProperties = {
					title: {
						title: [
							{
								text: {
									content: title,
								},
							},
						],
					},
				};

				await client.pages.update({
					page_id: pageId,
					properties: notionProperties as Parameters<
						typeof client.pages.update
					>[0]["properties"],
				});
			}

			// Update content if provided
			if (content !== undefined) {
				await this.updatePageContentFromMarkdown(pageId, content);
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
				throw new Error(`Failed to update page: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Update the content (blocks) of an existing Notion page from markdown
	 * This replaces all existing content with the new content converted from markdown
	 * @param pageId - The ID of the page to update
	 * @param markdown - The new content as markdown string
	 * @returns void
	 */
	async updatePageContentFromMarkdown(
		pageId: string,
		markdown: string,
	): Promise<void> {
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

			// Convert markdown to Notion blocks
			const blocks = this.convertMarkdownToBlocks(markdown);

			// Add new blocks to the page
			if (blocks.length > 0) {
				await client.blocks.children.append({
					block_id: pageId,
					children: blocks,
				});
			}
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(
					`Failed to update page content from markdown: ${error.message}`,
				);
			}
			throw error;
		}
	}

	/**
	 * Convert markdown text to Notion blocks
	 * @param markdown - The markdown content to convert
	 * @returns Array of Notion block objects
	 */
	private convertMarkdownToBlocks(markdown: string): BlockObjectRequest[] {
		const lines = markdown.split("\n");
		const blocks: BlockObjectRequest[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Skip empty lines
			if (line.trim() === "") {
				continue;
			}

			// Handle headings
			if (line.startsWith("### ")) {
				blocks.push({
					object: "block",
					type: "heading_3",
					heading_3: {
						rich_text: [
							{
								type: "text",
								text: {
									content: line.substring(4),
								},
							},
						],
					},
				});
			} else if (line.startsWith("## ")) {
				blocks.push({
					object: "block",
					type: "heading_2",
					heading_2: {
						rich_text: [
							{
								type: "text",
								text: {
									content: line.substring(3),
								},
							},
						],
					},
				});
			} else if (line.startsWith("# ")) {
				blocks.push({
					object: "block",
					type: "heading_1",
					heading_1: {
						rich_text: [
							{
								type: "text",
								text: {
									content: line.substring(2),
								},
							},
						],
					},
				});
			}
			// Handle bulleted lists
			else if (line.startsWith("- ") || line.startsWith("* ")) {
				blocks.push({
					object: "block",
					type: "bulleted_list_item",
					bulleted_list_item: {
						rich_text: [
							{
								type: "text",
								text: {
									content: line.substring(2),
								},
							},
						],
					},
				});
			}
			// Handle numbered lists
			else if (/^\d+\.\s/.test(line)) {
				const match = line.match(/^\d+\.\s(.*)$/);
				if (match) {
					blocks.push({
						object: "block",
						type: "numbered_list_item",
						numbered_list_item: {
							rich_text: [
								{
									type: "text",
									text: {
										content: match[1],
									},
								},
							],
						},
					});
				}
			}
			// Handle todo items
			else if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
				const checked = line.startsWith("- [x] ");
				const content = line.substring(6);
				blocks.push({
					object: "block",
					type: "to_do",
					to_do: {
						rich_text: [
							{
								type: "text",
								text: {
									content: content,
								},
							},
						],
						checked: checked,
					},
				});
			}
			// Handle code blocks
			else if (line.startsWith("```")) {
				const language = line.substring(3).trim() || "plain text";
				const codeLines: string[] = [];
				i++; // Move to next line

				// Collect code lines until closing ```
				while (i < lines.length && !lines[i].startsWith("```")) {
					codeLines.push(lines[i]);
					i++;
				}

				blocks.push({
					object: "block",
					type: "code",
					code: {
						rich_text: [
							{
								type: "text",
								text: {
									content: codeLines.join("\n"),
								},
							},
						],
						language: language as "c" | "java" | "typescript",
					},
				});
			}
			// Handle quotes
			else if (line.startsWith("> ")) {
				blocks.push({
					object: "block",
					type: "quote",
					quote: {
						rich_text: [
							{
								type: "text",
								text: {
									content: line.substring(2),
								},
							},
						],
					},
				});
			}
			// Handle regular paragraphs
			else {
				blocks.push({
					object: "block",
					type: "paragraph",
					paragraph: {
						rich_text: [
							{
								type: "text",
								text: {
									content: line,
								},
							},
						],
					},
				});
			}
		}

		return blocks;
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

		// Helper function to extract text from rich_text
		const extractRichText = (
			richText: RichTextItemResponse[] | RichTextItemResponse | undefined,
		): string => {
			if (!richText) return "";
			if (Array.isArray(richText)) {
				return richText
					.map((rt: RichTextItemResponse) => rt.plain_text || "")
					.join("");
			}
			return richText.plain_text || "";
		};

		// Handle blocks that have rich_text property by checking the block type directly
		switch (blockType) {
			case "paragraph":
				return extractRichText(block.paragraph.rich_text);
			case "heading_1":
				return extractRichText(block.heading_1.rich_text);
			case "heading_2":
				return extractRichText(block.heading_2.rich_text);
			case "heading_3":
				return extractRichText(block.heading_3.rich_text);
			case "bulleted_list_item":
				return extractRichText(block.bulleted_list_item.rich_text);
			case "numbered_list_item":
				return extractRichText(block.numbered_list_item.rich_text);
			case "quote":
				return extractRichText(block.quote.rich_text);
			case "callout":
				return extractRichText(block.callout.rich_text);
			case "toggle":
				return extractRichText(block.toggle.rich_text);
			case "to_do": {
				const todoText = extractRichText(block.to_do.rich_text);
				const checked = block.to_do.checked ? "[x]" : "[ ]";
				return `${checked} ${todoText}`;
			}
			case "code":
				return extractRichText(block.code.rich_text);
			case "equation":
				return block.equation.expression || "";
			case "child_page":
				return block.child_page.title || "";
			case "child_database":
				return block.child_database.title || "";
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
