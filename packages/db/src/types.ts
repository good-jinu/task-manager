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
export interface CreateTaskInput {
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
export interface UpdateTaskInput {
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
