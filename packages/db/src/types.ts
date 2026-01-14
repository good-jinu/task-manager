// Re-export task types from core for backward compatibility
export type {
	CreateTaskInput,
	ListTasksOptions,
	PaginatedResult,
	Task,
	TaskPriority,
	TaskService,
	TaskStatus,
	UpdateTaskInput,
} from "@task-manager/core";

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
 * Guest User model for DynamoDB storage
 */
export interface GuestUser {
	id: string; // Generated guest ID (UUID)
	createdAt: string; // Creation timestamp
	expiresAt: string; // TTL expiration (7 days)
	migrated: boolean; // Whether tasks were migrated to permanent account
}

/**
 * Task Integration model for DynamoDB storage
 * Maps internal tasks to external service task IDs
 */
export interface TaskIntegration {
	taskId: string; // Primary key (Internal task ID)
	provider: string; // External service provider (notion, etc.)
	externalId: string; // External task/page ID
	createdAt: string; // Integration creation timestamp (ISO string)
	updatedAt: string; // Last update timestamp (ISO string)
}

/**
 * Workspace Integration model for DynamoDB storage
 * Manages workspace-level integrations with external services
 */
export interface WorkspaceIntegration {
	id: string; // Primary key (UUID)
	workspaceId: string; // Workspace this integration belongs to
	provider: string; // External service provider (notion, etc.)
	externalId: string; // External resource ID (database ID, etc.)
	syncEnabled: boolean; // Whether sync is currently enabled
	config: {
		databaseId?: string; // For Notion: database ID
		databaseName?: string; // For Notion: database name
		importExisting?: boolean; // Whether to import existing items
		[key: string]: unknown; // Additional provider-specific config
	};
	lastSyncAt?: string; // Last successful sync timestamp (ISO string)
	lastError?: string; // Last sync error message
	createdAt: string; // Integration creation timestamp (ISO string)
	updatedAt: string; // Last update timestamp (ISO string)
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
 * Input types for creating new task integrations
 */
export interface CreateTaskIntegrationInput {
	provider: string;
	externalId: string;
}

/**
 * Input types for updating existing task integrations
 */
export interface UpdateTaskIntegrationInput {
	provider?: string;
	externalId?: string;
}

/**
 * Input types for creating new workspace integrations
 */
export interface CreateWorkspaceIntegrationInput {
	workspaceId: string;
	provider: string;
	externalId: string;
	config: {
		databaseId?: string;
		databaseName?: string;
		importExisting?: boolean;
		[key: string]: unknown;
	};
	syncEnabled?: boolean;
}

/**
 * Input types for updating existing workspace integrations
 */
export interface UpdateWorkspaceIntegrationInput {
	syncEnabled?: boolean;
	config?: {
		databaseId?: string;
		databaseName?: string;
		importExisting?: boolean;
		[key: string]: unknown;
	};
	lastSyncAt?: string;
	lastError?: string;
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
