/**
 * Notion task manager interface for dependency injection
 */
export interface NotionTaskManagerInterface {
	createPage(
		databaseId: string,
		properties: { title: string; content?: string },
	): Promise<{
		id: string;
		title: string;
		lastEditedTime: Date;
		archived: boolean;
	}>;
	updatePageWithMarkdown(
		pageId: string,
		title?: string,
		content?: string,
	): Promise<{
		id: string;
		title: string;
		lastEditedTime: Date;
		archived: boolean;
	}>;
	getPageContent(pageId: string): Promise<string>;
	getDatabasePages(databaseId: string): Promise<
		Array<{
			id: string;
			title: string;
			lastEditedTime: Date;
			archived: boolean;
		}>
	>;
	getDatabase(
		databaseId: string,
	): Promise<{ id: string; title: string; description?: string } | null>;
}

/**
 * Simplified Notion adapter for basic task operations
 * Full sync functionality will be implemented in the future
 */
export class NotionAdapter {
	readonly provider = "notion";

	constructor(private notionTaskManager: NotionTaskManagerInterface) {}

	/**
	 * Create a task in Notion
	 */
	async createTask(
		databaseId: string,
		task: { title: string; content?: string },
	): Promise<{
		id: string;
		title: string;
		lastEditedTime: Date;
		archived: boolean;
	}> {
		console.log("[NotionAdapter.createTask] Creating task in Notion:", {
			databaseId,
			title: task.title,
			hasContent: !!task.content,
		});

		const result = await this.notionTaskManager.createPage(databaseId, {
			title: task.title,
			content: task.content,
		});

		console.log("[NotionAdapter.createTask] Task created successfully:", {
			pageId: result.id,
			title: result.title,
		});

		return result;
	}

	/**
	 * Update a task in Notion
	 */
	async updateTask(
		pageId: string,
		task: { title?: string; content?: string },
	): Promise<{
		id: string;
		title: string;
		lastEditedTime: Date;
		archived: boolean;
	}> {
		console.log("[NotionAdapter.updateTask] Updating task in Notion:", {
			pageId,
			hasTitle: !!task.title,
			hasContent: !!task.content,
		});

		const result = await this.notionTaskManager.updatePageWithMarkdown(
			pageId,
			task.title,
			task.content,
		);

		console.log("[NotionAdapter.updateTask] Task updated successfully:", {
			pageId: result.id,
			title: result.title,
		});

		return result;
	}

	/**
	 * Get task content from Notion
	 */
	async getTaskContent(pageId: string): Promise<string> {
		console.log("[NotionAdapter.getTaskContent] Fetching task content:", {
			pageId,
		});
		const content = await this.notionTaskManager.getPageContent(pageId);
		console.log("[NotionAdapter.getTaskContent] Content retrieved:", {
			pageId,
			contentLength: content.length,
		});
		return content;
	}

	/**
	 * Get all tasks from a Notion database
	 */
	async getTasks(databaseId: string): Promise<
		Array<{
			id: string;
			title: string;
			lastEditedTime: Date;
			archived: boolean;
		}>
	> {
		console.log("[NotionAdapter.getTasks] Fetching tasks from database:", {
			databaseId,
		});
		const tasks = await this.notionTaskManager.getDatabasePages(databaseId);
		console.log("[NotionAdapter.getTasks] Tasks retrieved:", {
			databaseId,
			count: tasks.length,
		});
		return tasks;
	}

	/**
	 * Get database information
	 */
	async getDatabase(
		databaseId: string,
	): Promise<{ id: string; title: string; description?: string } | null> {
		console.log("[NotionAdapter.getDatabase] Fetching database info:", {
			databaseId,
		});
		const database = await this.notionTaskManager.getDatabase(databaseId);
		console.log("[NotionAdapter.getDatabase] Database info retrieved:", {
			databaseId,
			found: !!database,
			title: database?.title,
		});
		return database;
	}
}
