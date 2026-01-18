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

// RichTextItemRequest is not exported, so we define it based on the Notion API structure
type RichTextItemRequest = {
	type?: "text";
	text: {
		content: string;
		link?: {
			url: string;
		};
	};
	annotations?: {
		bold?: boolean;
		italic?: boolean;
		strikethrough?: boolean;
		underline?: boolean;
		code?: boolean;
	};
};

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
		console.log("[NotionTaskManager.getDatabases] Starting database fetch");
		try {
			const client = await this.getClient();
			console.log(
				"[NotionTaskManager.getDatabases] Client obtained, searching databases",
			);

			const response = await client.search({
				filter: {
					value: "database",
					property: "object",
				},
			});

			console.log(
				"[NotionTaskManager.getDatabases] Search response received:",
				{
					totalResults: response.results.length,
				},
			);

			const databases = response.results
				.filter((result) => result.object === "database")
				.filter((database) => this.hasRequiredDatabaseProperties(database))
				.map((database: DatabaseObjectResponse) =>
					this.mapNotionDatabaseToInterface(database),
				);

			console.log(
				"[NotionTaskManager.getDatabases] Databases filtered and mapped:",
				{
					count: databases.length,
					titles: databases.map((db) => db.title),
				},
			);

			return databases;
		} catch (error) {
			console.error(
				"[NotionTaskManager.getDatabases] Failed to get databases:",
				error,
			);
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
		console.log("[NotionTaskManager.getDatabasePages] Fetching pages:", {
			databaseId,
		});
		try {
			const client = await this.getClient();
			console.log(
				"[NotionTaskManager.getDatabasePages] Client obtained, querying database",
			);

			const response = await client.databases.query({
				database_id: databaseId,
			});

			console.log(
				"[NotionTaskManager.getDatabasePages] Query response received:",
				{
					totalResults: response.results.length,
				},
			);

			const pages = response.results
				.filter(isFullPage)
				.map((page: PageObjectResponse) => this.mapNotionPageToInterface(page));

			console.log("[NotionTaskManager.getDatabasePages] Pages mapped:", {
				count: pages.length,
				titles: pages.map((p) => p.title),
			});

			return pages;
		} catch (error) {
			console.error(
				"[NotionTaskManager.getDatabasePages] Failed to get pages:",
				{
					databaseId,
					error,
				},
			);
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
		console.log("[NotionTaskManager.createPage] Creating page:", {
			databaseId,
			title: properties.title,
			hasContent: !!properties.content,
		});
		try {
			const client = await this.getClient();
			console.log("[NotionTaskManager.createPage] Client obtained");

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

			console.log("[NotionTaskManager.createPage] Built page structure:", {
				hasChildren: children.length > 0,
				childrenCount: children.length,
			});

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
				console.error(
					"[NotionTaskManager.createPage] Incomplete response received",
				);
				throw new Error("Failed to create page: incomplete response");
			}

			const page = this.mapNotionPageToInterface(response);
			console.log("[NotionTaskManager.createPage] Page created successfully:", {
				pageId: page.id,
				title: page.title,
			});

			return page;
		} catch (error) {
			console.error("[NotionTaskManager.createPage] Failed to create page:", {
				databaseId,
				title: properties.title,
				error,
			});
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
		const processedLines = new Set<number>(); // Track which lines have been processed

		for (let i = 0; i < lines.length; i++) {
			// Skip if this line was already processed as a nested item
			if (processedLines.has(i)) {
				continue;
			}

			const line = lines[i];

			// Skip empty lines
			if (line.trim() === "") {
				continue;
			}

			// Detect indentation level (for nested lists)
			const indentMatch = line.match(/^(\s*)/);
			const indentLevel = indentMatch
				? Math.floor(indentMatch[1].length / 2)
				: 0;
			const trimmedLine = line.trim();

			// Skip indented lines at the top level (they should be children of previous items)
			if (indentLevel > 0) {
				continue;
			}

			// Handle headings
			if (trimmedLine.startsWith("### ")) {
				blocks.push({
					object: "block",
					type: "heading_3",
					heading_3: {
						rich_text: this.parseInlineFormatting(trimmedLine.substring(4)),
					},
				});
			} else if (trimmedLine.startsWith("## ")) {
				blocks.push({
					object: "block",
					type: "heading_2",
					heading_2: {
						rich_text: this.parseInlineFormatting(trimmedLine.substring(3)),
					},
				});
			} else if (trimmedLine.startsWith("# ")) {
				blocks.push({
					object: "block",
					type: "heading_1",
					heading_1: {
						rich_text: this.parseInlineFormatting(trimmedLine.substring(2)),
					},
				});
			}
			// Handle todo items (must come before bulleted lists)
			else if (
				trimmedLine.startsWith("- [ ] ") ||
				trimmedLine.startsWith("- [x] ")
			) {
				const checked = trimmedLine.startsWith("- [x] ");
				const content = trimmedLine.substring(6);
				const block: any = {
					object: "block",
					type: "to_do",
					to_do: {
						rich_text: this.parseInlineFormatting(content),
						checked: checked,
					},
				};

				// Handle nested items
				const children = this.collectNestedItems(lines, i, indentLevel);
				if (children.length > 0) {
					block.to_do.children = children;
				}

				blocks.push(block as BlockObjectRequest);
			}
			// Handle bulleted lists
			else if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
				const content = trimmedLine.substring(2);
				const block: any = {
					object: "block",
					type: "bulleted_list_item",
					bulleted_list_item: {
						rich_text: this.parseInlineFormatting(content),
					},
				};

				// Handle nested items
				const children = this.collectNestedItems(lines, i, indentLevel);
				if (children.length > 0) {
					block.bulleted_list_item.children = children;
				}

				blocks.push(block as BlockObjectRequest);
			}
			// Handle numbered lists
			else if (/^\d+\.\s/.test(trimmedLine)) {
				const match = trimmedLine.match(/^\d+\.\s(.*)$/);
				if (match) {
					const block: any = {
						object: "block",
						type: "numbered_list_item",
						numbered_list_item: {
							rich_text: this.parseInlineFormatting(match[1]),
						},
					};

					// Handle nested items
					const children = this.collectNestedItems(lines, i, indentLevel);
					if (children.length > 0) {
						block.numbered_list_item.children = children;
					}

					blocks.push(block as BlockObjectRequest);
				}
			}
			// Handle code blocks
			else if (trimmedLine.startsWith("```")) {
				const language = trimmedLine.substring(3).trim() || "plain text";
				const codeLines: string[] = [];
				i++; // Move to next line

				// Collect code lines until closing ```
				while (i < lines.length && !lines[i].trim().startsWith("```")) {
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
			else if (trimmedLine.startsWith("> ")) {
				blocks.push({
					object: "block",
					type: "quote",
					quote: {
						rich_text: this.parseInlineFormatting(trimmedLine.substring(2)),
					},
				});
			}
			// Handle regular paragraphs
			else {
				blocks.push({
					object: "block",
					type: "paragraph",
					paragraph: {
						rich_text: this.parseInlineFormatting(trimmedLine),
					},
				});
			}
		}

		return blocks;
	}

	/**
	 * Collect nested list items (children) for a parent item
	 */
	private collectNestedItems(
		lines: string[],
		currentIndex: number,
		parentIndentLevel: number,
	): BlockObjectRequest[] {
		const children: BlockObjectRequest[] = [];
		let i = currentIndex + 1;

		while (i < lines.length) {
			const line = lines[i];
			if (line.trim() === "") {
				i++;
				continue;
			}

			const indentMatch = line.match(/^(\s*)/);
			const indentLevel = indentMatch
				? Math.floor(indentMatch[1].length / 2)
				: 0;

			// If indent level is not greater than parent, we're done with children
			if (indentLevel <= parentIndentLevel) {
				break;
			}

			// Only process direct children (one level deeper)
			if (indentLevel === parentIndentLevel + 1) {
				const trimmedLine = line.trim();

				// Handle nested bulleted list
				if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
					const content = trimmedLine.substring(2);
					const block: any = {
						object: "block",
						type: "bulleted_list_item",
						bulleted_list_item: {
							rich_text: this.parseInlineFormatting(content),
						},
					};

					// Recursively collect nested children
					const nestedChildren = this.collectNestedItems(lines, i, indentLevel);
					if (nestedChildren.length > 0) {
						block.bulleted_list_item.children = nestedChildren;
					}

					children.push(block as BlockObjectRequest);
				}
				// Handle nested numbered list
				else if (/^\d+\.\s/.test(trimmedLine)) {
					const match = trimmedLine.match(/^\d+\.\s(.*)$/);
					if (match) {
						const block: any = {
							object: "block",
							type: "numbered_list_item",
							numbered_list_item: {
								rich_text: this.parseInlineFormatting(match[1]),
							},
						};

						// Recursively collect nested children
						const nestedChildren = this.collectNestedItems(
							lines,
							i,
							indentLevel,
						);
						if (nestedChildren.length > 0) {
							block.numbered_list_item.children = nestedChildren;
						}

						children.push(block as BlockObjectRequest);
					}
				}
			}

			i++;
		}

		return children;
	}

	/**
	 * Parse inline markdown formatting (bold, italic, code, links)
	 * Returns array of rich text objects with proper annotations
	 */
	private parseInlineFormatting(text: string): RichTextItemRequest[] {
		const richText: RichTextItemRequest[] = [];

		// If no special formatting, return simple text
		if (
			!text.includes("**") &&
			!text.includes("*") &&
			!text.includes("`") &&
			!text.includes("[")
		) {
			return [{ type: "text", text: { content: text } }];
		}

		const patterns: Array<{
			regex: RegExp;
			annotation: Record<string, boolean> | null;
		}> = [
			// Bold: **text**
			{
				regex: /\*\*([^*]+)\*\*/g,
				annotation: { bold: true } as Record<string, boolean>,
			},
			// Italic: *text* or _text_
			{
				regex: /(?<!\*)\*([^*]+)\*(?!\*)/g,
				annotation: { italic: true } as Record<string, boolean>,
			},
			{
				regex: /_([^_]+)_/g,
				annotation: { italic: true } as Record<string, boolean>,
			},
			// Code: `text`
			{
				regex: /`([^`]+)`/g,
				annotation: { code: true } as Record<string, boolean>,
			},
			// Strikethrough: ~~text~~
			{
				regex: /~~([^~]+)~~/g,
				annotation: { strikethrough: true } as Record<string, boolean>,
			},
			// Links: [text](url)
			{ regex: /\[([^\]]+)\]\(([^)]+)\)/g, annotation: null },
		];

		// Find all matches with their positions
		const matches: Array<{
			start: number;
			end: number;
			content: string;
			annotation: Record<string, boolean> | null;
			url?: string;
		}> = [];

		for (const pattern of patterns) {
			const regex = new RegExp(pattern.regex.source, "g");
			let match = regex.exec(text);

			while (match !== null) {
				if (pattern.annotation === null) {
					// Link pattern
					matches.push({
						start: match.index,
						end: match.index + match[0].length,
						content: match[1],
						annotation: null,
						url: match[2],
					});
				} else {
					matches.push({
						start: match.index,
						end: match.index + match[0].length,
						content: match[1],
						annotation: pattern.annotation,
					});
				}
				match = regex.exec(text);
			}
		}

		// Sort matches by position
		matches.sort((a, b) => a.start - b.start);

		// Build rich text array
		let lastEnd = 0;

		for (const match of matches) {
			// Add plain text before this match
			if (match.start > lastEnd) {
				const plainText = text.substring(lastEnd, match.start);
				if (plainText) {
					richText.push({
						type: "text",
						text: { content: plainText },
					});
				}
			}

			// Add formatted text
			const textObj: RichTextItemRequest = {
				type: "text",
				text: { content: match.content },
			};

			if (match.url) {
				textObj.text.link = { url: match.url };
			}

			if (match.annotation) {
				textObj.annotations = match.annotation;
			}

			richText.push(textObj);
			lastEnd = match.end;
		}

		// Add remaining plain text
		if (lastEnd < text.length) {
			const plainText = text.substring(lastEnd);
			if (plainText) {
				richText.push({
					type: "text",
					text: { content: plainText },
				});
			}
		}

		return richText.length > 0
			? richText
			: [{ type: "text", text: { content: text } }];
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
		console.log("[NotionTaskManager.getPageContent] Fetching content:", {
			pageId,
		});
		try {
			const client = await this.getClient();
			console.log(
				"[NotionTaskManager.getPageContent] Client obtained, listing blocks",
			);

			const response = await client.blocks.children.list({
				block_id: pageId,
			});

			console.log("[NotionTaskManager.getPageContent] Blocks retrieved:", {
				blockCount: response.results.length,
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

			const content = contentParts.join("\n");
			console.log("[NotionTaskManager.getPageContent] Content extracted:", {
				pageId,
				contentLength: content.length,
				blocksParsed: contentParts.length,
			});

			return content;
		} catch (error) {
			console.error(
				"[NotionTaskManager.getPageContent] Failed to get content:",
				{
					pageId,
					error,
				},
			);
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
