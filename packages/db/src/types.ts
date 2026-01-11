/**
 * User model for DynamoDB storage
 */
export interface User {
	id: string; // Primary key (UUID)
	notionUserId: string; // Notion user ID from OAuth
	email: string; // User email from Notion
	name: string; // Display name
	avatarUrl?: string; // Profile picture URL
	notionAccessToken: string; // Notion access token for API calls
	notionRefreshToken?: string; // Notion refresh token for token renewal
	tokenExpiresAt?: string; // When the access token expires (ISO string)
	createdAt: string; // Account creation timestamp (ISO string)
	updatedAt: string; // Last update timestamp (ISO string)
}

/**
 * Input types for creating new records
 */
export interface CreateUserInput {
	notionUserId: string;
	email: string;
	name: string;
	avatarUrl?: string;
	notionAccessToken: string;
	notionRefreshToken?: string;
	tokenExpiresAt?: string;
}

/**
 * Input types for updating existing records
 */
export interface UpdateUserInput {
	email?: string;
	name?: string;
	avatarUrl?: string;
	notionAccessToken?: string;
	notionRefreshToken?: string;
	tokenExpiresAt?: string;
}

/**
 * Task status enumeration
 */
export type TaskStatus = "todo" | "in-progress" | "done" | "archived";

/**
 * Task priority enumeration
 */
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/**
 * Task model for DynamoDB storage
 */
export interface Task {
	id: string; // UUID, primary key
	workspaceId: string; // Foreign key to workspace
	title: string; // Task title (required)
	content?: string; // Task description/content
	status: TaskStatus; // Current status
	priority?: TaskPriority; // Optional priority level
	dueDate?: string; // ISO date string
	archived: boolean; // Soft delete flag
	createdAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp
}

/**
 * Workspace model for DynamoDB storage
 */
export interface Workspace {
	id: string; // UUID, primary key
	userId: string; // Owner user ID
	name: string; // Workspace name
	description?: string; // Optional description
	createdAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp
}

/**
 * External Integration model for DynamoDB storage
 */
export interface ExternalIntegration {
	id: string; // UUID, primary key
	workspaceId: string; // Foreign key to workspace
	provider: string; // 'notion' or future providers
	externalId: string; // External resource ID (e.g., Notion database ID)
	config: Record<string, unknown>; // Provider-specific configuration
	syncEnabled: boolean; // Whether sync is active
	lastSyncAt?: string; // Last successful sync timestamp
	createdAt: string; // ISO timestamp
}

/**
 * Sync status enumeration
 */
export type SyncStatus = "pending" | "synced" | "conflict" | "error";

/**
 * Sync Metadata model for DynamoDB storage
 */
export interface SyncMetadata {
	taskId: string; // Foreign key to task
	integrationId: string; // Foreign key to integration
	externalId: string; // External task/page ID
	syncStatus: SyncStatus; // Current sync state
	lastSyncAt?: string; // Last sync attempt timestamp
	lastExternalUpdate?: string; // Last known external modification time
	retryCount: number; // Number of retry attempts
	lastError?: string; // Last error message if failed
}

/**
 * Guest User model for DynamoDB storage
 */
export interface GuestUser {
	id: string; // Generated guest ID (UUID)
	createdAt: string; // Creation timestamp
	expiresAt: string; // TTL expiration (7 days)
	migrated: boolean; // Whether tasks were migrated to permanent account
}

/**
 * Input types for creating new tasks
 */
export interface CreateTaskInput extends Record<string, unknown> {
	workspaceId: string;
	title: string;
	content?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	dueDate?: string;
}

/**
 * Input types for updating existing tasks
 */
export interface UpdateTaskInput extends Record<string, unknown> {
	title?: string;
	content?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	dueDate?: string;
}

/**
 * Options for listing tasks
 */
export interface ListTasksOptions {
	limit?: number;
	cursor?: string;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
	items: T[];
	nextCursor?: string;
	hasMore: boolean;
}

/**
 * Input types for creating new workspaces
 */
export interface CreateWorkspaceInput {
	name: string;
	description?: string;
}

/**
 * Input types for updating existing workspaces
 */
export interface UpdateWorkspaceInput {
	name?: string;
	description?: string;
}

/**
 * Input types for creating new integrations
 */
export interface CreateIntegrationInput {
	provider: "notion" | string;
	externalId: string;
	config: Record<string, unknown>;
	syncEnabled?: boolean;
}

/**
 * Input types for updating existing integrations
 */
export interface UpdateIntegrationInput {
	config?: Record<string, unknown>;
	syncEnabled?: boolean;
	lastSyncAt?: string;
}

/**
 * Migration result from importing external data
 */
export interface MigrationResult {
	migrationId: string;
	workspaceId: string;
	totalTasks: number;
	successCount: number;
	failureCount: number;
	errors: MigrationError[];
}

/**
 * Migration progress tracking
 */
export interface MigrationProgress {
	migrationId: string;
	status: "pending" | "in-progress" | "completed" | "failed";
	totalTasks: number;
	processedTasks: number;
	successCount: number;
	failureCount: number;
}

/**
 * Migration error details
 */
export interface MigrationError {
	notionPageId: string;
	error: string;
}

/**
 * Input types for creating new sync metadata
 */
export interface CreateSyncMetadataInput {
	taskId: string;
	integrationId: string;
	externalId: string;
	syncStatus?: SyncStatus;
	lastExternalUpdate?: string;
}

/**
 * Input types for updating existing sync metadata
 */
export interface UpdateSyncMetadataInput {
	externalId?: string;
	syncStatus?: SyncStatus;
	lastSyncAt?: string;
	lastExternalUpdate?: string;
	retryCount?: number;
	lastError?: string;
}

/**
 * Sync result for individual operations
 */
export interface SyncResult {
	success: boolean;
	externalId?: string;
	error?: string;
}

/**
 * Batch sync result
 */
export interface BatchSyncResult {
	successful: SyncResult[];
	failed: SyncResult[];
}

/**
 * External task data representation
 */
export interface ExternalTaskData {
	externalId: string;
	title: string;
	content?: string;
	status?: string;
	priority?: string;
	dueDate?: string;
	lastModified: Date;
	archived?: boolean;
	raw: unknown;
}

/**
 * Conflict resolution strategies
 */
export type ConflictStrategy = "internal-wins" | "external-wins" | "manual";

/**
 * Conflict information
 */
export interface ConflictInfo {
	taskId: string;
	integrationId: string;
	internalVersion: Task;
	externalVersion: ExternalTaskData;
	fieldDifferences: FieldDifference[];
}

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

/**
 * Field difference in conflicts
 */
export interface FieldDifference {
	field: string;
	internalValue: unknown;
	externalValue: unknown;
}

/**
 * Conflict resolution input
 */
export interface ConflictResolution {
	strategy: ConflictStrategy;
	selectedVersion?: "internal" | "external";
	mergedFields?: Partial<Task>;
}

/**
 * Sync process result
 */
export interface SyncProcessResult {
	processed: number;
	succeeded: number;
	failed: number;
	conflicts: number;
}

/**
 * Sync queue operation
 */
export interface SyncQueueOperation {
	taskId: string;
	integrationId: string;
	operation: "push" | "pull";
	priority: number;
	createdAt: string;
	retryCount: number;
}
/**
 * Sync scheduler configuration
 */
export interface SyncSchedulerConfig {
	defaultSyncInterval: number; // Default sync interval in milliseconds
	maxRetryAttempts: number; // Maximum retry attempts for failed syncs
	retryBackoffMultiplier: number; // Multiplier for exponential backoff
	conflictDetectionEnabled: boolean; // Whether to detect and handle conflicts
	batchSyncThreshold: number; // Threshold for batch sync operations
}

/**
 * Sync statistics for monitoring and performance tracking
 */
export interface SyncStatistics {
	integrationId: string;
	totalSyncAttempts: number;
	successfulSyncs: number;
	failedSyncs: number;
	conflictCount: number;
	averageSyncDuration: number; // Average duration in milliseconds
	lastSyncAt: Date | null;
	lastSyncAttemptAt: Date | null;
	lastSyncDuration: number | null; // Duration in milliseconds
	lastSyncError: string | null;
	lastSyncErrorAt: Date | null;
	manualSyncCount: number;
	lastManualSyncAt: Date | null;
}

/**
 * Sync timing control options
 */
export interface SyncTimingOptions {
	autoSync: boolean; // Whether automatic sync is enabled
	syncInterval: number; // Sync interval in seconds
	manualSyncEnabled: boolean; // Whether manual sync is allowed
	conflictResolution: ConflictStrategy; // Default conflict resolution strategy
}

/**
 * Enhanced sync queue operation with timing controls
 */
export interface EnhancedSyncQueueOperation extends SyncQueueOperation {
	scheduledAt?: string; // When the operation was scheduled (ISO string)
	maxRetries?: number; // Maximum retry attempts for this operation
	backoffMultiplier?: number; // Custom backoff multiplier
	timeoutMs?: number; // Operation timeout in milliseconds
}
/**
 * Input types for creating sync statistics
 */
export interface CreateSyncStatisticsInput {
	totalSyncAttempts?: number;
	successfulSyncs?: number;
	failedSyncs?: number;
	conflictCount?: number;
	averageSyncDuration?: number;
	lastSyncAt?: Date | null;
	lastSyncAttemptAt?: Date | null;
	lastSyncDuration?: number | null;
	lastSyncError?: string | null;
	lastSyncErrorAt?: Date | null;
	manualSyncCount?: number;
	lastManualSyncAt?: Date | null;
}

/**
 * Input types for updating sync statistics
 */
export interface UpdateSyncStatisticsInput {
	totalSyncAttempts?: number;
	successfulSyncs?: number;
	failedSyncs?: number;
	conflictCount?: number;
	averageSyncDuration?: number;
	lastSyncAt?: Date | null;
	lastSyncAttemptAt?: Date | null;
	lastSyncDuration?: number | null;
	lastSyncError?: string | null;
	lastSyncErrorAt?: Date | null;
	manualSyncCount?: number;
	lastManualSyncAt?: Date | null;
}

/**
 * Sync history entry for detailed monitoring
 */
export interface SyncHistoryEntry {
	id: string; // Composite key: integrationId-timestamp
	integrationId: string;
	timestamp: Date;
	operation: "push" | "pull" | "manual" | "scheduled";
	success: boolean;
	duration?: number; // Duration in milliseconds
	tasksProcessed?: number;
	tasksSucceeded?: number;
	tasksFailed?: number;
	conflictsDetected?: number;
	error?: string;
	metadata?: Record<string, unknown>; // Additional context
}

/**
 * Sync performance monitoring data
 */
export interface SyncPerformanceMetrics {
	integrationId: string;
	period: {
		startDate: Date;
		endDate: Date;
		days: number;
	};
	successRate: number; // Percentage
	errorRate: number; // Percentage
	conflictRate: number; // Percentage
	averageResponseTime: number; // Milliseconds
	totalSyncs: number;
	peakSyncTime?: Date; // Time of highest sync activity
	slowestSync?: {
		timestamp: Date;
		duration: number;
	};
	fastestSync?: {
		timestamp: Date;
		duration: number;
	};
	dailyStats: Array<{
		date: string;
		syncs: number;
		errors: number;
		averageDuration: number;
	}>;
}
