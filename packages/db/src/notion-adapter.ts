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
		return await this.notionTaskManager.createPage(databaseId, {
			title: task.title,
			content: task.content,
		});
	}

	/**
	 * Get task content from Notion
	 */
	async getTaskContent(pageId: string): Promise<string> {
		return await this.notionTaskManager.getPageContent(pageId);
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
		return await this.notionTaskManager.getDatabasePages(databaseId);
	}

	/**
	 * Get database information
	 */
	async getDatabase(
		databaseId: string,
	): Promise<{ id: string; title: string; description?: string } | null> {
		return await this.notionTaskManager.getDatabase(databaseId);
	}
}
