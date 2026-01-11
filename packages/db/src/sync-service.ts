import type { IntegrationService } from "./integration-service";
import type { SyncMetadataService } from "./sync-metadata-service";
import type { TaskService } from "./task-service";
import type {
	ConflictInfo,
	ConflictResolution,
	EnhancedSyncQueueOperation,
	ExternalIntegration,
	FieldDifference,
	SyncAdapter,
	SyncMetadata,
	SyncProcessResult,
	SyncTimingOptions,
	Task,
} from "./types";

/**
 * Service for managing synchronization between internal tasks and external services
 */
export class SyncService {
	private adapters = new Map<string, SyncAdapter>();
	private syncQueue: EnhancedSyncQueueOperation[] = [];
	private isProcessing = false;
	private queueProcessingInterval: NodeJS.Timeout | null = null;

	constructor(
		private syncMetadataService: SyncMetadataService,
		private taskService: TaskService,
		private integrationService: IntegrationService,
	) {
		// Start queue processing with 5-second intervals
		this.startQueueProcessing();
	}

	/**
	 * Register a sync adapter for a provider
	 */
	registerAdapter(adapter: SyncAdapter): void {
		this.adapters.set(adapter.provider, adapter);
	}

	/**
	 * Get a sync adapter by provider
	 */
	private getAdapter(provider: string): SyncAdapter {
		const adapter = this.adapters.get(provider);
		if (!adapter) {
			throw new Error(`No sync adapter registered for provider: ${provider}`);
		}
		return adapter;
	}

	/**
	 * Start automatic queue processing
	 */
	private startQueueProcessing(): void {
		if (this.queueProcessingInterval) {
			return;
		}

		this.queueProcessingInterval = setInterval(async () => {
			if (!this.isProcessing && this.syncQueue.length > 0) {
				await this.processSyncQueue();
			}
		}, 5000); // Process queue every 5 seconds
	}

	/**
	 * Stop automatic queue processing
	 */
	stopQueueProcessing(): void {
		if (this.queueProcessingInterval) {
			clearInterval(this.queueProcessingInterval);
			this.queueProcessingInterval = null;
		}
	}

	/**
	 * Queue a sync operation with enhanced timing controls
	 */
	async queueSync(
		taskId: string,
		integrationId: string,
		operation: "push" | "pull",
		options?: {
			priority?: number;
			maxRetries?: number;
			backoffMultiplier?: number;
			timeoutMs?: number;
			immediate?: boolean;
		},
	): Promise<void> {
		// Check if integration exists and is enabled
		const integration =
			await this.integrationService.getIntegration(integrationId);
		if (!integration || !integration.syncEnabled) {
			return; // Skip if integration doesn't exist or is disabled
		}

		// Create enhanced queue operation
		const queueItem: EnhancedSyncQueueOperation = {
			taskId,
			integrationId,
			operation,
			priority: options?.priority ?? (operation === "push" ? 1 : 2),
			createdAt: new Date().toISOString(),
			retryCount: 0,
			scheduledAt: new Date().toISOString(),
			maxRetries: options?.maxRetries ?? 3,
			backoffMultiplier: options?.backoffMultiplier ?? 2,
			timeoutMs: options?.timeoutMs ?? 30000, // 30 second default timeout
		};

		// Add to queue
		this.syncQueue.push(queueItem);

		// Sort queue by priority (lower number = higher priority)
		this.syncQueue.sort((a, b) => a.priority - b.priority);

		// If immediate sync requested, process queue now
		if (options?.immediate) {
			await this.processSyncQueue();
		}
	}

	/**
	 * Trigger immediate manual sync for a task
	 */
	async triggerImmediateSync(
		taskId: string,
		integrationId: string,
		operation: "push" | "pull" = "push",
	): Promise<void> {
		await this.queueSync(taskId, integrationId, operation, {
			priority: 0, // Highest priority
			immediate: true,
		});
	}

	/**
	 * Process the sync queue with enhanced retry logic
	 */
	async processSyncQueue(): Promise<SyncProcessResult> {
		if (this.isProcessing) {
			return {
				processed: 0,
				succeeded: 0,
				failed: 0,
				conflicts: 0,
			};
		}

		this.isProcessing = true;

		const result: SyncProcessResult = {
			processed: 0,
			succeeded: 0,
			failed: 0,
			conflicts: 0,
		};

		try {
			// Process queue items
			while (this.syncQueue.length > 0) {
				const queueItem = this.syncQueue.shift();
				if (!queueItem) break;
				result.processed++;

				try {
					const success = await this.processSyncOperation(queueItem);
					if (success) {
						result.succeeded++;
					} else {
						result.failed++;
					}
				} catch (error) {
					// Check if it's a conflict
					if (error instanceof Error && error.message.includes("conflict")) {
						result.conflicts++;
					} else {
						result.failed++;
						// Enhanced retry logic with configurable parameters
						if (queueItem.retryCount < (queueItem.maxRetries ?? 3)) {
							queueItem.retryCount++;
							// Exponential backoff with configurable multiplier
							const backoffMultiplier = queueItem.backoffMultiplier ?? 2;
							const delay = Math.min(
								2 ** queueItem.retryCount * 1000 * backoffMultiplier,
								300000, // Max 5 minutes
							);

							setTimeout(() => {
								if (this.syncQueue.length < 100) {
									// Prevent queue overflow
									this.syncQueue.push(queueItem);
									this.syncQueue.sort((a, b) => a.priority - b.priority);
								}
							}, delay);
						}
					}
				}
			}
		} finally {
			this.isProcessing = false;
		}

		return result;
	}

	/**
	 * Process a single sync operation with timeout support
	 */
	private async processSyncOperation(
		queueItem: EnhancedSyncQueueOperation,
	): Promise<boolean> {
		const { taskId, integrationId, operation, timeoutMs } = queueItem;

		// Get integration
		const integration =
			await this.integrationService.getIntegration(integrationId);
		if (!integration || !integration.syncEnabled) {
			return false;
		}

		const adapter = this.getAdapter(integration.provider);

		// Create timeout promise
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Sync operation timed out after ${timeoutMs}ms`));
			}, timeoutMs ?? 30000);
		});

		try {
			// Race between sync operation and timeout
			const syncPromise =
				operation === "push"
					? this.processPushOperation(
							taskId,
							integration,
							adapter,
							queueItem.retryCount,
						)
					: this.processPullOperation(
							taskId,
							integrationId,
							integration,
							adapter,
							queueItem.retryCount,
						);

			return await Promise.race([syncPromise, timeoutPromise]);
		} catch (error) {
			// Log timeout or other errors
			console.error(`Sync operation failed for task ${taskId}:`, error);
			throw error;
		}
	}

	/**
	 * Process a push operation
	 */
	private async processPushOperation(
		taskId: string,
		integration: ExternalIntegration,
		adapter: SyncAdapter,
		retryCount: number,
	): Promise<boolean> {
		try {
			// Get the task
			const task = await this.taskService.getTask(taskId);
			if (!task) {
				throw new Error(`Task not found: ${taskId}`);
			}

			// Check for existing sync metadata
			const syncMetadata = await this.syncMetadataService.getSyncMetadata(
				taskId,
				integration.id,
			);

			// If sync metadata exists, check for conflicts
			if (syncMetadata?.externalId) {
				const externalTask = await adapter.pullTask(
					syncMetadata.externalId,
					integration,
				);
				if (externalTask) {
					const conflict = this.detectConflict(
						task,
						externalTask,
						syncMetadata,
					);
					if (conflict) {
						// Mark as conflict and throw
						await this.syncMetadataService.updateSyncMetadata(
							taskId,
							integration.id,
							{
								syncStatus: "conflict",
								lastError: "Conflict detected during push",
							},
						);
						throw new Error("Conflict detected during push operation");
					}
				}
			}

			// Push the task
			const result = await adapter.pushTask(task, integration);

			if (result.success && result.externalId) {
				// Update or create sync metadata
				const now = new Date().toISOString();
				if (syncMetadata) {
					await this.syncMetadataService.updateSyncMetadata(
						taskId,
						integration.id,
						{
							externalId: result.externalId,
							syncStatus: "synced",
							lastSyncAt: now,
							retryCount: 0,
							lastError: undefined,
						},
					);
				} else {
					await this.syncMetadataService.createSyncMetadata({
						taskId,
						integrationId: integration.id,
						externalId: result.externalId,
						syncStatus: "synced",
					});
					await this.syncMetadataService.updateSyncMetadata(
						taskId,
						integration.id,
						{
							lastSyncAt: now,
						},
					);
				}
				return true;
			} else {
				// Update sync metadata with error
				if (syncMetadata) {
					await this.syncMetadataService.updateSyncMetadata(
						taskId,
						integration.id,
						{
							syncStatus: "error",
							retryCount: retryCount,
							lastError: result.error || "Unknown push error",
						},
					);
				}
				return false;
			}
		} catch (error) {
			// Update sync metadata with error
			const syncMetadata = await this.syncMetadataService.getSyncMetadata(
				taskId,
				integration.id,
			);
			if (syncMetadata) {
				await this.syncMetadataService.updateSyncMetadata(
					taskId,
					integration.id,
					{
						syncStatus: "error",
						retryCount: retryCount,
						lastError: error instanceof Error ? error.message : "Unknown error",
					},
				);
			}
			throw error;
		}
	}

	/**
	 * Process a pull operation
	 */
	private async processPullOperation(
		taskId: string,
		integrationId: string,
		integration: ExternalIntegration,
		adapter: SyncAdapter,
		retryCount: number,
	): Promise<boolean> {
		try {
			// Get sync metadata
			const syncMetadata = await this.syncMetadataService.getSyncMetadata(
				taskId,
				integrationId,
			);
			if (!syncMetadata || !syncMetadata.externalId) {
				throw new Error("No sync metadata found for pull operation");
			}

			// Pull the external task
			const externalTask = await adapter.pullTask(
				syncMetadata.externalId,
				integration,
			);
			if (!externalTask) {
				// External task not found or deleted
				await this.syncMetadataService.updateSyncMetadata(
					taskId,
					integrationId,
					{
						syncStatus: "error",
						lastError: "External task not found",
						retryCount: retryCount,
					},
				);
				return false;
			}

			// Get the internal task
			const internalTask = await this.taskService.getTask(taskId);
			if (!internalTask) {
				throw new Error(`Internal task not found: ${taskId}`);
			}

			// Check for conflicts
			const conflict = this.detectConflict(
				internalTask,
				externalTask,
				syncMetadata,
			);
			if (conflict) {
				// Mark as conflict
				await this.syncMetadataService.updateSyncMetadata(
					taskId,
					integrationId,
					{
						syncStatus: "conflict",
						lastError: "Conflict detected during pull",
					},
				);
				throw new Error("Conflict detected during pull operation");
			}

			// Update the internal task with external data
			const externalMapped = adapter.mapFromExternal(externalTask);
			await this.taskService.updateTask(taskId, externalMapped);

			// Update sync metadata
			const now = new Date().toISOString();
			await this.syncMetadataService.updateSyncMetadata(taskId, integrationId, {
				syncStatus: "synced",
				lastSyncAt: now,
				lastExternalUpdate: externalTask.lastModified.toISOString(),
				retryCount: 0,
				lastError: undefined,
			});

			return true;
		} catch (error) {
			// Update sync metadata with error
			const syncMetadata = await this.syncMetadataService.getSyncMetadata(
				taskId,
				integrationId,
			);
			if (syncMetadata) {
				await this.syncMetadataService.updateSyncMetadata(
					taskId,
					integrationId,
					{
						syncStatus: "error",
						retryCount: retryCount,
						lastError: error instanceof Error ? error.message : "Unknown error",
					},
				);
			}
			throw error;
		}
	}

	/**
	 * Get sync status for a task and integration
	 */
	async getSyncStatus(
		taskId: string,
		integrationId: string,
	): Promise<SyncMetadata | null> {
		return await this.syncMetadataService.getSyncMetadata(
			taskId,
			integrationId,
		);
	}

	/**
	 * Detect conflicts between internal and external tasks
	 */
	detectConflicts(
		taskId: string,
		integrationId: string,
	): Promise<ConflictInfo | null> {
		return this.detectConflictsInternal(taskId, integrationId);
	}

	/**
	 * Internal conflict detection
	 */
	private async detectConflictsInternal(
		taskId: string,
		integrationId: string,
	): Promise<ConflictInfo | null> {
		// Get sync metadata
		const syncMetadata = await this.syncMetadataService.getSyncMetadata(
			taskId,
			integrationId,
		);
		if (!syncMetadata || !syncMetadata.externalId) {
			return null;
		}

		// Get integration
		const integration =
			await this.integrationService.getIntegration(integrationId);
		if (!integration) {
			return null;
		}

		// Get internal task
		const internalTask = await this.taskService.getTask(taskId);
		if (!internalTask) {
			return null;
		}

		// Get external task
		const adapter = this.getAdapter(integration.provider);
		const externalTask = await adapter.pullTask(
			syncMetadata.externalId,
			integration,
		);
		if (!externalTask) {
			return null;
		}

		const conflict = this.detectConflict(
			internalTask,
			externalTask,
			syncMetadata,
		);
		if (!conflict) {
			return null;
		}

		// Build field differences
		const fieldDifferences = this.buildFieldDifferences(
			internalTask,
			externalTask,
		);

		return {
			taskId,
			integrationId,
			internalVersion: internalTask,
			externalVersion: externalTask,
			fieldDifferences,
		};
	}

	/**
	 * Detect conflict between internal and external task
	 */
	private detectConflict(
		internalTask: Task,
		externalTask: { lastModified: Date },
		syncMetadata: SyncMetadata,
	): boolean {
		if (!syncMetadata.lastSyncAt) {
			return false; // No previous sync, no conflict
		}

		const lastSyncDate = new Date(syncMetadata.lastSyncAt);
		const internalModified = new Date(internalTask.updatedAt);
		const externalModified = externalTask.lastModified;

		// Conflict if both internal and external were modified after last sync
		return internalModified > lastSyncDate && externalModified > lastSyncDate;
	}

	/**
	 * Build field differences between internal and external tasks
	 */
	private buildFieldDifferences(
		internalTask: Task,
		externalTask: { title: string; content?: string; status?: string },
	): FieldDifference[] {
		const differences: FieldDifference[] = [];

		if (internalTask.title !== externalTask.title) {
			differences.push({
				field: "title",
				internalValue: internalTask.title,
				externalValue: externalTask.title,
			});
		}

		if (internalTask.content !== externalTask.content) {
			differences.push({
				field: "content",
				internalValue: internalTask.content,
				externalValue: externalTask.content,
			});
		}

		// Add more field comparisons as needed

		return differences;
	}

	/**
	 * Resolve a sync conflict
	 */
	async resolveSyncConflict(
		taskId: string,
		integrationId: string,
		resolution: ConflictResolution,
	): Promise<Task> {
		// Get conflict info
		const conflictInfo = await this.detectConflictsInternal(
			taskId,
			integrationId,
		);
		if (!conflictInfo) {
			throw new Error("No conflict found to resolve");
		}

		// Get integration and adapter
		const integration =
			await this.integrationService.getIntegration(integrationId);
		if (!integration) {
			throw new Error("Integration not found");
		}

		const adapter = this.getAdapter(integration.provider);

		// Resolve the conflict
		let resolvedTask: Task;
		switch (resolution.strategy) {
			case "internal-wins":
				resolvedTask = adapter.resolveConflict(
					conflictInfo.internalVersion,
					conflictInfo.externalVersion,
					"internal-wins",
				);
				// Push to external service
				await adapter.pushTask(resolvedTask, integration);
				break;

			case "external-wins": {
				resolvedTask = adapter.resolveConflict(
					conflictInfo.internalVersion,
					conflictInfo.externalVersion,
					"external-wins",
				);
				// Update internal task
				const externalMapped = adapter.mapFromExternal(
					conflictInfo.externalVersion,
				);
				await this.taskService.updateTask(taskId, externalMapped);
				const updatedTask = await this.taskService.getTask(taskId);
				if (!updatedTask) {
					throw new Error(`Failed to retrieve updated task: ${taskId}`);
				}
				resolvedTask = updatedTask;
				break;
			}

			case "manual": {
				if (!resolution.mergedFields) {
					throw new Error("Merged fields required for manual resolution");
				}
				// Apply merged fields
				await this.taskService.updateTask(taskId, resolution.mergedFields);
				const updatedTask = await this.taskService.getTask(taskId);
				if (!updatedTask) {
					throw new Error(`Failed to retrieve updated task: ${taskId}`);
				}
				resolvedTask = updatedTask;
				// Push to external service
				await adapter.pushTask(resolvedTask, integration);
				break;
			}

			default:
				throw new Error(`Unknown resolution strategy: ${resolution.strategy}`);
		}

		// Update sync metadata to mark as resolved
		const now = new Date().toISOString();
		await this.syncMetadataService.updateSyncMetadata(taskId, integrationId, {
			syncStatus: "synced",
			lastSyncAt: now,
			lastExternalUpdate:
				conflictInfo.externalVersion.lastModified.toISOString(),
			retryCount: 0,
			lastError: undefined,
		});

		return resolvedTask;
	}

	/**
	 * Get sync timing options for an integration
	 */
	async getSyncTimingOptions(
		integrationId: string,
	): Promise<SyncTimingOptions | null> {
		const integration =
			await this.integrationService.getIntegration(integrationId);
		if (!integration) {
			return null;
		}

		// Extract timing options from integration config
		const config = integration.config as Record<string, unknown>;
		return {
			autoSync: typeof config?.autoSync === "boolean" ? config.autoSync : true,
			syncInterval:
				typeof config?.syncInterval === "number" ? config.syncInterval : 30, // Default 30 seconds
			manualSyncEnabled:
				typeof config?.manualSyncEnabled === "boolean"
					? config.manualSyncEnabled
					: true,
			conflictResolution:
				typeof config?.conflictResolution === "string" &&
				["internal-wins", "external-wins", "manual"].includes(
					config.conflictResolution,
				)
					? (config.conflictResolution as
							| "internal-wins"
							| "external-wins"
							| "manual")
					: "manual",
		};
	}

	/**
	 * Update sync timing options for an integration
	 */
	async updateSyncTimingOptions(
		integrationId: string,
		options: Partial<SyncTimingOptions>,
	): Promise<void> {
		const integration =
			await this.integrationService.getIntegration(integrationId);
		if (!integration) {
			throw new Error("Integration not found");
		}

		// Update integration config with new timing options
		const updatedConfig = {
			...integration.config,
			...options,
		};

		await this.integrationService.updateIntegration(integrationId, {
			config: updatedConfig,
		});
	}

	/**
	 * Get current sync queue status
	 */
	getSyncQueueStatus(): {
		queueLength: number;
		isProcessing: boolean;
		nextScheduledSync: string | null;
	} {
		const nextItem = this.syncQueue[0];
		return {
			queueLength: this.syncQueue.length,
			isProcessing: this.isProcessing,
			nextScheduledSync: nextItem?.scheduledAt ?? null,
		};
	}

	/**
	 * Clear sync queue for a specific integration
	 */
	clearSyncQueue(integrationId?: string): void {
		if (integrationId) {
			this.syncQueue = this.syncQueue.filter(
				(item) => item.integrationId !== integrationId,
			);
		} else {
			this.syncQueue = [];
		}
	}

	/**
	 * Cleanup method to stop queue processing
	 */
	destroy(): void {
		this.stopQueueProcessing();
		this.clearSyncQueue();
	}
}
