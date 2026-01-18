import { randomUUID } from "node:crypto";
import type { TaskIntegrationService } from "./task-integration-service";
import type { TaskService } from "./task-service";
import type {
	MigrationError,
	MigrationProgress,
	MigrationResult,
	Task,
} from "./types";
import type { WorkspaceService } from "./workspace-service";

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
 * Service for migrating data from external services to internal storage
 */
export class MigrationService {
	private migrations = new Map<string, MigrationProgress>();

	constructor(
		public notionTaskManager: NotionTaskManagerInterface | null,
		private taskService: TaskService,
		private workspaceService: WorkspaceService,
		private taskIntegrationService: TaskIntegrationService,
	) {}

	/**
	 * Import tasks from a Notion database
	 */
	async importFromNotion(
		userId: string,
		notionDatabaseId: string,
		targetWorkspaceId?: string,
	): Promise<MigrationResult> {
		const migrationId = randomUUID();
		console.log("[MigrationService.importFromNotion] Starting import:", {
			migrationId,
			userId,
			notionDatabaseId,
			targetWorkspaceId,
		});

		let workspaceId = targetWorkspaceId;

		// Check if notionTaskManager is available
		if (!this.notionTaskManager) {
			console.error(
				"[MigrationService.importFromNotion] NotionTaskManager not available",
			);
			throw new Error("NotionTaskManager is not available");
		}

		try {
			// Create workspace if not provided
			if (!workspaceId) {
				console.log(
					"[MigrationService.importFromNotion] No workspace provided, fetching database info",
				);
				const database =
					await this.notionTaskManager.getDatabase(notionDatabaseId);
				if (!database) {
					console.error(
						"[MigrationService.importFromNotion] Database not found:",
						{ notionDatabaseId },
					);
					throw new Error(`Notion database not found: ${notionDatabaseId}`);
				}

				console.log(
					"[MigrationService.importFromNotion] Creating new workspace:",
					{
						databaseTitle: database.title,
					},
				);
				const workspace = await this.workspaceService.createWorkspace(userId, {
					name: database.title || "Imported from Notion",
					description: database.description || "Imported from Notion database",
				});
				workspaceId = workspace.id;
				console.log("[MigrationService.importFromNotion] Workspace created:", {
					workspaceId,
				});
			}

			// Get all pages from the Notion database
			console.log(
				"[MigrationService.importFromNotion] Fetching pages from Notion database",
			);
			const notionPages =
				await this.notionTaskManager.getDatabasePages(notionDatabaseId);

			console.log("[MigrationService.importFromNotion] Pages fetched:", {
				totalPages: notionPages.length,
			});

			// Initialize migration progress
			const migrationProgress: MigrationProgress = {
				migrationId,
				status: "in-progress",
				totalTasks: notionPages.length,
				processedTasks: 0,
				successCount: 0,
				failureCount: 0,
			};
			this.migrations.set(migrationId, migrationProgress);
			console.log(
				"[MigrationService.importFromNotion] Migration progress initialized",
			);

			const errors: MigrationError[] = [];
			const importedTasks: Task[] = [];

			// Process each Notion page
			for (const notionPage of notionPages) {
				console.log("[MigrationService.importFromNotion] Processing page:", {
					pageId: notionPage.id,
					title: notionPage.title,
					processedCount: migrationProgress.processedTasks + 1,
					totalCount: notionPages.length,
				});

				try {
					// Get page content
					console.log(
						"[MigrationService.importFromNotion] Fetching page content:",
						{
							pageId: notionPage.id,
						},
					);
					const content = await this.notionTaskManager.getPageContent(
						notionPage.id,
					);
					console.log("[MigrationService.importFromNotion] Content fetched:", {
						pageId: notionPage.id,
						contentLength: content.length,
					});

					// Create internal task
					console.log(
						"[MigrationService.importFromNotion] Creating internal task:",
						{
							workspaceId,
							title: notionPage.title || "Untitled",
						},
					);
					const task = await this.taskService.createTask({
						workspaceId,
						title: notionPage.title || "Untitled",
						content: content || undefined,
						status: notionPage.archived ? "archived" : "todo",
					});
					console.log(
						"[MigrationService.importFromNotion] Internal task created:",
						{
							taskId: task.id,
							title: task.title,
						},
					);

					// Create task integration linking internal task to Notion page
					console.log(
						"[MigrationService.importFromNotion] Creating task integration:",
						{
							taskId: task.id,
							notionPageId: notionPage.id,
						},
					);
					await this.taskIntegrationService.create(task.id, {
						provider: "notion",
						externalId: notionPage.id,
					});
					console.log(
						"[MigrationService.importFromNotion] Task integration created",
					);

					importedTasks.push(task);
					migrationProgress.successCount++;
					console.log(
						"[MigrationService.importFromNotion] Page processed successfully:",
						{
							pageId: notionPage.id,
							successCount: migrationProgress.successCount,
						},
					);
				} catch (error) {
					console.error(
						"[MigrationService.importFromNotion] Failed to process page:",
						{
							pageId: notionPage.id,
							title: notionPage.title,
							error,
						},
					);
					migrationProgress.failureCount++;
					errors.push({
						notionPageId: notionPage.id,
						error: error instanceof Error ? error.message : "Unknown error",
					});
				}

				migrationProgress.processedTasks++;
				this.migrations.set(migrationId, { ...migrationProgress });
			}

			// Mark migration as completed
			migrationProgress.status = "completed";
			this.migrations.set(migrationId, { ...migrationProgress });

			const result = {
				migrationId,
				workspaceId,
				totalTasks: notionPages.length,
				successCount: migrationProgress.successCount,
				failureCount: migrationProgress.failureCount,
				errors,
			};

			console.log("[MigrationService.importFromNotion] Import completed:", {
				migrationId,
				workspaceId,
				totalTasks: result.totalTasks,
				successCount: result.successCount,
				failureCount: result.failureCount,
				errorCount: errors.length,
			});

			return result;
		} catch (error) {
			// Mark migration as failed
			const migrationProgress = this.migrations.get(migrationId);
			if (migrationProgress) {
				migrationProgress.status = "failed";
				this.migrations.set(migrationId, migrationProgress);
			}

			throw new Error(
				`Migration failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	}

	/**
	 * Get migration progress
	 */
	async getMigrationProgress(migrationId: string): Promise<MigrationProgress> {
		const progress = this.migrations.get(migrationId);
		if (!progress) {
			throw new Error(`Migration not found: ${migrationId}`);
		}
		return progress;
	}

	/**
	 * Import tasks from Notion with progress tracking and error handling
	 */
	async importFromNotionWithProgress(
		userId: string,
		notionDatabaseId: string,
		targetWorkspaceId?: string,
		progressCallback?: (progress: MigrationProgress) => void,
	): Promise<MigrationResult> {
		const migrationId = randomUUID();
		let workspaceId = targetWorkspaceId;

		// Check if notionTaskManager is available
		if (!this.notionTaskManager) {
			throw new Error("NotionTaskManager is not available");
		}

		try {
			// Create workspace if not provided
			if (!workspaceId) {
				const database =
					await this.notionTaskManager.getDatabase(notionDatabaseId);
				if (!database) {
					throw new Error(`Notion database not found: ${notionDatabaseId}`);
				}

				const workspace = await this.workspaceService.createWorkspace(userId, {
					name: database.title || "Imported from Notion",
					description: database.description || "Imported from Notion database",
				});
				workspaceId = workspace.id;
			}

			// Get all pages from the Notion database
			const notionPages =
				await this.notionTaskManager.getDatabasePages(notionDatabaseId);

			// Initialize migration progress
			const migrationProgress: MigrationProgress = {
				migrationId,
				status: "in-progress",
				totalTasks: notionPages.length,
				processedTasks: 0,
				successCount: 0,
				failureCount: 0,
			};
			this.migrations.set(migrationId, migrationProgress);

			// Call progress callback if provided
			if (progressCallback) {
				progressCallback({ ...migrationProgress });
			}

			const errors: MigrationError[] = [];

			// Process each Notion page with progress updates
			for (let i = 0; i < notionPages.length; i++) {
				const notionPage = notionPages[i];

				try {
					// Get page content
					const content = await this.notionTaskManager.getPageContent(
						notionPage.id,
					);

					// Create internal task
					const task = await this.taskService.createTask({
						workspaceId,
						title: notionPage.title || "Untitled",
						content: content || undefined,
						status: notionPage.archived ? "archived" : "todo",
					});

					// Create task integration linking internal task to Notion page
					await this.taskIntegrationService.create(task.id, {
						provider: "notion",
						externalId: notionPage.id,
					});

					migrationProgress.successCount++;
				} catch (error) {
					migrationProgress.failureCount++;
					errors.push({
						notionPageId: notionPage.id,
						error: error instanceof Error ? error.message : "Unknown error",
					});

					// Continue processing remaining pages even if one fails
					console.error(
						`Failed to import page ${notionPage.id}:`,
						error instanceof Error ? error.message : error,
					);
				}

				migrationProgress.processedTasks++;
				this.migrations.set(migrationId, { ...migrationProgress });

				// Call progress callback if provided
				if (progressCallback) {
					progressCallback({ ...migrationProgress });
				}
			}

			// Mark migration as completed
			migrationProgress.status = "completed";
			this.migrations.set(migrationId, { ...migrationProgress });

			// Final progress callback
			if (progressCallback) {
				progressCallback({ ...migrationProgress });
			}

			return {
				migrationId,
				workspaceId,
				totalTasks: notionPages.length,
				successCount: migrationProgress.successCount,
				failureCount: migrationProgress.failureCount,
				errors,
			};
		} catch (error) {
			// Mark migration as failed
			const migrationProgress = this.migrations.get(migrationId);
			if (migrationProgress) {
				migrationProgress.status = "failed";
				this.migrations.set(migrationId, migrationProgress);

				// Call progress callback with failed status
				if (progressCallback) {
					progressCallback({ ...migrationProgress });
				}
			}

			throw new Error(
				`Migration failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	}

	/**
	 * Clean up completed migrations from memory
	 */
	cleanupCompletedMigrations(): void {
		const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

		const entries = Array.from(this.migrations.entries());
		for (const [migrationId, progress] of entries) {
			if (
				(progress.status === "completed" || progress.status === "failed") &&
				new Date() > cutoffTime
			) {
				this.migrations.delete(migrationId);
			}
		}
	}

	/**
	 * Get all active migrations
	 */
	getActiveMigrations(): MigrationProgress[] {
		return Array.from(this.migrations.values()).filter(
			(progress) => progress.status === "in-progress",
		);
	}

	/**
	 * Cancel a migration (if still in progress)
	 */
	async cancelMigration(migrationId: string): Promise<boolean> {
		const progress = this.migrations.get(migrationId);
		if (!progress) {
			return false;
		}

		if (progress.status === "in-progress") {
			progress.status = "failed";
			this.migrations.set(migrationId, progress);
			return true;
		}

		return false;
	}
}
