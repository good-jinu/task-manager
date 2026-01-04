import type {
	BatchSyncResult,
	ConflictStrategy,
	ExternalIntegration,
	ExternalTaskData,
	SyncResult,
	Task,
} from "./types";

/**
 * Interface for external service sync adapters
 * Provides a plugin architecture for integrating with external services
 */
export interface SyncAdapter {
	/** The provider identifier (e.g., 'notion') */
	readonly provider: string;

	/**
	 * Push a single task to the external service
	 * @param task - The internal task to push
	 * @param integration - The integration configuration
	 * @returns Promise resolving to sync result
	 */
	pushTask(task: Task, integration: ExternalIntegration): Promise<SyncResult>;

	/**
	 * Pull a single task from the external service
	 * @param externalId - The external task/page ID
	 * @param integration - The integration configuration
	 * @returns Promise resolving to external task data or null if not found
	 */
	pullTask(
		externalId: string,
		integration: ExternalIntegration,
	): Promise<ExternalTaskData | null>;

	/**
	 * Push multiple tasks to the external service
	 * @param tasks - Array of internal tasks to push
	 * @param integration - The integration configuration
	 * @returns Promise resolving to batch sync result
	 */
	pushBatch(
		tasks: Task[],
		integration: ExternalIntegration,
	): Promise<BatchSyncResult>;

	/**
	 * Pull multiple tasks from the external service
	 * @param integration - The integration configuration
	 * @param since - Optional date to filter tasks modified since this date
	 * @returns Promise resolving to array of external task data
	 */
	pullBatch(
		integration: ExternalIntegration,
		since?: Date,
	): Promise<ExternalTaskData[]>;

	/**
	 * Map internal task to external task format
	 * @param task - The internal task
	 * @returns External task data representation
	 */
	mapToExternal(task: Task): ExternalTaskData;

	/**
	 * Map external task to internal task format
	 * @param external - The external task data
	 * @returns Partial internal task data
	 */
	mapFromExternal(external: ExternalTaskData): Partial<Task>;

	/**
	 * Resolve conflicts between internal and external versions
	 * @param internal - The internal task version
	 * @param external - The external task version
	 * @param strategy - The conflict resolution strategy
	 * @returns Resolved task
	 */
	resolveConflict(
		internal: Task,
		external: ExternalTaskData,
		strategy: ConflictStrategy,
	): Task;
}
