import { randomUUID } from "node:crypto";
import type { IntegrationService } from "./integration-service";
import type { SyncMetadataService } from "./sync-metadata-service";
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
		private notionTaskManager: NotionTaskManagerInterface,
		private taskService: TaskService,
		private workspaceService: WorkspaceService,
		private syncMetadataService: SyncMetadataService,
		private integrationService: IntegrationService,
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
		let workspaceId = targetWorkspaceId;

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

			const errors: MigrationError[] = [];
			const importedTasks: Task[] = [];

			// Create integration for this workspace
			const integration = await this.integrationService.createIntegration(
				workspaceId,
				{
					provider: "notion",
					externalId: notionDatabaseId,
					config: {
						databaseTitle: notionPages.length > 0 ? "Imported Database" : "",
					},
					syncEnabled: true,
				},
			);

			// Process each Notion page
			for (const notionPage of notionPages) {
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

					// Create sync metadata linking internal task to Notion page
					await this.syncMetadataService.createSyncMetadata({
						taskId: task.id,
						integrationId: integration.id,
						externalId: notionPage.id,
						syncStatus: "synced",
						lastExternalUpdate: notionPage.lastEditedTime.toISOString(),
					});

					// Update sync metadata with last sync time
					await this.syncMetadataService.updateSyncMetadata(
						task.id,
						integration.id,
						{
							lastSyncAt: new Date().toISOString(),
						},
					);

					importedTasks.push(task);
					migrationProgress.successCount++;
				} catch (error) {
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

			// Create integration for this workspace
			const integration = await this.integrationService.createIntegration(
				workspaceId,
				{
					provider: "notion",
					externalId: notionDatabaseId,
					config: {
						databaseTitle: notionPages.length > 0 ? "Imported Database" : "",
					},
					syncEnabled: true,
				},
			);

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

					// Create sync metadata linking internal task to Notion page
					await this.syncMetadataService.createSyncMetadata({
						taskId: task.id,
						integrationId: integration.id,
						externalId: notionPage.id,
						syncStatus: "synced",
						lastExternalUpdate: notionPage.lastEditedTime.toISOString(),
					});

					// Update sync metadata with last sync time
					await this.syncMetadataService.updateSyncMetadata(
						task.id,
						integration.id,
						{
							lastSyncAt: new Date().toISOString(),
						},
					);

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
