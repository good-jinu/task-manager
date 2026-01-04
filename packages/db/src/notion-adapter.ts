import type { SyncAdapter } from "./sync-adapter";
import type {
	BatchSyncResult,
	ConflictStrategy,
	ExternalIntegration,
	ExternalTaskData,
	SyncResult,
	Task,
	TaskPriority,
	TaskStatus,
} from "./types";

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
 * Notion adapter implementation for syncing tasks with Notion databases
 */
export class NotionAdapter implements SyncAdapter {
	readonly provider = "notion";

	constructor(private notionTaskManager: NotionTaskManagerInterface) {}

	/**
	 * Push a single task to Notion
	 */
	async pushTask(
		task: Task,
		integration: ExternalIntegration,
	): Promise<SyncResult> {
		try {
			const databaseId = integration.externalId;
			const externalData = this.mapToExternal(task);

			// Check if this is an update (task already has external ID in sync metadata)
			// For now, we'll always create a new page since we don't have sync metadata here
			// The SyncService will handle checking for existing external IDs
			const notionPage = await this.notionTaskManager.createPage(databaseId, {
				title: externalData.title,
				content: externalData.content,
			});

			return {
				success: true,
				externalId: notionPage.id,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Pull a single task from Notion
	 */
	async pullTask(
		externalId: string,
		integration: ExternalIntegration,
	): Promise<ExternalTaskData | null> {
		try {
			// Get the page content
			const content = await this.notionTaskManager.getPageContent(externalId);

			// Get the database pages to find our specific page
			const databaseId = integration.externalId;
			const pages = await this.notionTaskManager.getDatabasePages(databaseId);
			const page = pages.find((p) => p.id === externalId);

			if (!page) {
				return null;
			}

			return {
				externalId: page.id,
				title: page.title,
				content: content || undefined,
				status: page.archived ? "archived" : "todo", // Default mapping
				lastModified: page.lastEditedTime,
				archived: page.archived,
				raw: page,
			};
		} catch (error) {
			// If page not found or access denied, return null
			return null;
		}
	}

	/**
	 * Push multiple tasks to Notion
	 */
	async pushBatch(
		tasks: Task[],
		integration: ExternalIntegration,
	): Promise<BatchSyncResult> {
		const successful: SyncResult[] = [];
		const failed: SyncResult[] = [];

		for (const task of tasks) {
			const result = await this.pushTask(task, integration);
			if (result.success) {
				successful.push(result);
			} else {
				failed.push(result);
			}
		}

		return { successful, failed };
	}

	/**
	 * Pull multiple tasks from Notion
	 */
	async pullBatch(
		integration: ExternalIntegration,
		since?: Date,
	): Promise<ExternalTaskData[]> {
		try {
			const databaseId = integration.externalId;
			const pages = await this.notionTaskManager.getDatabasePages(databaseId);

			const externalTasks: ExternalTaskData[] = [];

			for (const page of pages) {
				// Filter by date if provided
				if (since && page.lastEditedTime <= since) {
					continue;
				}

				try {
					const content = await this.notionTaskManager.getPageContent(page.id);

					externalTasks.push({
						externalId: page.id,
						title: page.title,
						content: content || undefined,
						status: page.archived ? "archived" : "todo", // Default mapping
						lastModified: page.lastEditedTime,
						archived: page.archived,
						raw: page,
					});
				} catch (error) {}
			}

			return externalTasks;
		} catch (error) {
			throw new Error(
				`Failed to pull batch from Notion: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	}

	/**
	 * Map internal task to external format
	 */
	mapToExternal(task: Task): ExternalTaskData {
		return {
			externalId: "", // Will be set when created in external service
			title: task.title,
			content: task.content,
			status: this.mapStatusToExternal(task.status),
			priority: this.mapPriorityToExternal(task.priority),
			dueDate: task.dueDate,
			lastModified: new Date(task.updatedAt),
			archived: task.archived,
			raw: task,
		};
	}

	/**
	 * Map external task to internal format
	 */
	mapFromExternal(external: ExternalTaskData): Partial<Task> {
		return {
			title: external.title,
			content: external.content,
			status: this.mapStatusFromExternal(external.status),
			priority: this.mapPriorityFromExternal(external.priority),
			dueDate: external.dueDate,
			archived: external.archived || false,
			updatedAt: external.lastModified.toISOString(),
		};
	}

	/**
	 * Resolve conflicts between internal and external versions
	 */
	resolveConflict(
		internal: Task,
		external: ExternalTaskData,
		strategy: ConflictStrategy,
	): Task {
		switch (strategy) {
			case "internal-wins":
				return internal;

			case "external-wins": {
				const externalMapped = this.mapFromExternal(external);
				return {
					...internal,
					...externalMapped,
					// Preserve internal-only fields
					id: internal.id,
					workspaceId: internal.workspaceId,
					createdAt: internal.createdAt,
				};
			}

			case "manual":
				// For manual resolution, return the internal version
				// The conflict will be marked and handled separately
				return internal;

			default:
				throw new Error(`Unknown conflict strategy: ${strategy}`);
		}
	}

	/**
	 * Map internal task status to external format
	 */
	private mapStatusToExternal(status: TaskStatus): string {
		switch (status) {
			case "todo":
				return "Not started";
			case "in-progress":
				return "In progress";
			case "done":
				return "Done";
			case "archived":
				return "Archived";
			default:
				return "Not started";
		}
	}

	/**
	 * Map external status to internal format
	 */
	private mapStatusFromExternal(status?: string): TaskStatus {
		if (!status) return "todo";

		const lowerStatus = status.toLowerCase();
		if (lowerStatus.includes("progress") || lowerStatus.includes("doing")) {
			return "in-progress";
		}
		if (lowerStatus.includes("done") || lowerStatus.includes("complete")) {
			return "done";
		}
		if (lowerStatus.includes("archive")) {
			return "archived";
		}
		return "todo";
	}

	/**
	 * Map internal priority to external format
	 */
	private mapPriorityToExternal(priority?: TaskPriority): string | undefined {
		if (!priority) return undefined;

		switch (priority) {
			case "low":
				return "Low";
			case "medium":
				return "Medium";
			case "high":
				return "High";
			case "urgent":
				return "Urgent";
			default:
				return undefined;
		}
	}

	/**
	 * Map external priority to internal format
	 */
	private mapPriorityFromExternal(priority?: string): TaskPriority | undefined {
		if (!priority) return undefined;

		const lowerPriority = priority.toLowerCase();
		if (lowerPriority.includes("urgent")) return "urgent";
		if (lowerPriority.includes("high")) return "high";
		if (lowerPriority.includes("medium")) return "medium";
		if (lowerPriority.includes("low")) return "low";

		return undefined;
	}
}
