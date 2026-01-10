import type { IntegrationService } from "./integration-service";
import type { SyncService } from "./sync-service";
import type { SyncStatisticsService } from "./sync-statistics-service";
import type { TaskService } from "./task-service";
import type {
	ExternalIntegration,
	SyncSchedulerConfig,
	SyncStatistics,
} from "./types";

/**
 * Service for managing automatic sync timing and scheduling
 */
export class SyncScheduler {
	private scheduledSyncs = new Map<string, NodeJS.Timeout>();
	private isRunning = false;
	private config: SyncSchedulerConfig;

	constructor(
		private syncService: SyncService,
		private integrationService: IntegrationService,
		_taskService: TaskService,
		private syncStatisticsService: SyncStatisticsService,
		config?: Partial<SyncSchedulerConfig>,
	) {
		this.config = {
			defaultSyncInterval: 30000, // 30 seconds
			maxRetryAttempts: 3,
			retryBackoffMultiplier: 2,
			conflictDetectionEnabled: true,
			batchSyncThreshold: 10,
			...config,
		};
	}

	/**
	 * Start the sync scheduler
	 */
	start(): void {
		if (this.isRunning) {
			return;
		}

		this.isRunning = true;
		this.scheduleAllIntegrations();
	}

	/**
	 * Stop the sync scheduler
	 */
	stop(): void {
		if (!this.isRunning) {
			return;
		}

		this.isRunning = false;

		// Clear all scheduled syncs
		for (const [_, timeout] of this.scheduledSyncs.entries()) {
			clearTimeout(timeout);
		}
		this.scheduledSyncs.clear();
	}

	/**
	 * Schedule automatic sync for a specific integration
	 */
	async scheduleIntegrationSync(integrationId: string): Promise<void> {
		const integration =
			await this.integrationService.getIntegration(integrationId);
		if (!integration || !integration.syncEnabled) {
			return;
		}

		// Clear existing schedule if any
		this.clearIntegrationSync(integrationId);

		// Get sync interval from integration config or use default
		const syncInterval = this.getSyncInterval(integration);

		// Schedule the sync
		const timeout = setTimeout(async () => {
			await this.performScheduledSync(integrationId, "scheduled");
			// Reschedule for next interval
			if (this.isRunning) {
				await this.scheduleIntegrationSync(integrationId);
			}
		}, syncInterval);

		this.scheduledSyncs.set(integrationId, timeout);
	}

	/**
	 * Clear scheduled sync for a specific integration
	 */
	clearIntegrationSync(integrationId: string): void {
		const timeout = this.scheduledSyncs.get(integrationId);
		if (timeout) {
			clearTimeout(timeout);
			this.scheduledSyncs.delete(integrationId);
		}
	}

	/**
	 * Trigger manual sync for an integration
	 */
	async triggerManualSync(integrationId: string): Promise<void> {
		const integration =
			await this.integrationService.getIntegration(integrationId);
		if (!integration) {
			throw new Error(`Integration not found: ${integrationId}`);
		}

		// Record manual sync attempt
		await this.syncStatisticsService.incrementManualSync(integrationId);

		// Perform the sync immediately
		await this.performScheduledSync(integrationId, "manual");
	}

	/**
	 * Get sync statistics for an integration
	 */
	async getSyncStatistics(
		integrationId: string,
	): Promise<SyncStatistics | null> {
		return await this.syncStatisticsService.getSyncStatistics(integrationId);
	}

	/**
	 * Update sync configuration for the scheduler
	 */
	updateConfig(config: Partial<SyncSchedulerConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Schedule all active integrations
	 */
	private async scheduleAllIntegrations(): Promise<void> {
		// This would need to be implemented to get all active integrations
		// For now, we'll rely on individual integration scheduling
	}

	/**
	 * Perform a scheduled sync for an integration with comprehensive monitoring
	 */
	private async performScheduledSync(
		integrationId: string,
		operation: "scheduled" | "manual" = "scheduled",
	): Promise<void> {
		const startTime = Date.now();

		try {
			// Record sync attempt start
			await this.syncStatisticsService.recordSyncHistory(integrationId, {
				operation,
				success: false, // Will update on success
			});

			// Get all tasks that need syncing for this integration
			const tasks = await this.getTasksForSync(integrationId);

			if (tasks.length === 0) {
				const duration = Date.now() - startTime;

				// Record successful sync with no tasks
				await this.syncStatisticsService.incrementSyncAttempt(
					integrationId,
					true,
					duration,
				);

				await this.syncStatisticsService.recordSyncHistory(integrationId, {
					operation,
					success: true,
					duration,
					tasksProcessed: 0,
					tasksSucceeded: 0,
					tasksFailed: 0,
					conflictsDetected: 0,
				});

				return;
			}

			// Queue sync operations for all tasks
			const syncPromises = tasks.map((task) =>
				this.syncService.queueSync(task.id, integrationId, "push"),
			);
			await Promise.all(syncPromises);

			// Process the sync queue
			const result = await this.syncService.processSyncQueue();

			const duration = Date.now() - startTime;
			const success = result.failed === 0 && result.conflicts === 0;

			// Update statistics
			await this.syncStatisticsService.incrementSyncAttempt(
				integrationId,
				success,
				duration,
				success
					? undefined
					: `${result.failed} failed, ${result.conflicts} conflicts`,
			);

			// Record detailed sync history
			await this.syncStatisticsService.recordSyncHistory(integrationId, {
				operation,
				success,
				duration,
				tasksProcessed: result.processed,
				tasksSucceeded: result.succeeded,
				tasksFailed: result.failed,
				conflictsDetected: result.conflicts,
				metadata: {
					queueLength: tasks.length,
					batchSize: Math.min(tasks.length, this.config.batchSyncThreshold),
				},
			});

			// Handle conflicts if enabled
			if (this.config.conflictDetectionEnabled && result.conflicts > 0) {
				await this.handleSyncConflicts(integrationId);
			}
		} catch (error) {
			const duration = Date.now() - startTime;
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			// Record failed sync attempt
			await this.syncStatisticsService.incrementSyncAttempt(
				integrationId,
				false,
				duration,
				errorMessage,
			);

			await this.syncStatisticsService.recordSyncHistory(integrationId, {
				operation,
				success: false,
				duration,
				error: errorMessage,
			});

			console.error(
				`Scheduled sync failed for integration ${integrationId}:`,
				error,
			);
		}
	}

	/**
	 * Get tasks that need syncing for an integration
	 */
	private async getTasksForSync(
		_integrationId: string,
	): Promise<Array<{ id: string }>> {
		// This would need to be implemented to get tasks that have been modified
		// since the last sync or need to be synced
		// For now, return empty array as placeholder
		return [];
	}

	/**
	 * Handle sync conflicts for an integration
	 */
	private async handleSyncConflicts(integrationId: string): Promise<void> {
		// This would implement conflict detection and resolution
		// For now, just log the conflicts
		console.warn(`Sync conflicts detected for integration ${integrationId}`);
	}

	/**
	 * Get sync interval for an integration
	 */
	private getSyncInterval(integration: ExternalIntegration): number {
		// Check if integration config has custom sync interval
		if (integration.config && typeof integration.config === "object") {
			const config = integration.config as Record<string, unknown>;
			if (config.syncInterval && typeof config.syncInterval === "number") {
				return config.syncInterval * 1000; // Convert seconds to milliseconds
			}
		}

		return this.config.defaultSyncInterval;
	}
}
