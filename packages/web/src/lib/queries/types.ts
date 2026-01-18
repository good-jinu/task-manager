// Shared types for queries
export interface NotionDatabase {
	id: string;
	name: string;
	title: string; // For compatibility with existing code
	url?: string;
	icon?: {
		type: "emoji" | "external" | "file";
		emoji?: string;
		external?: { url: string };
		file?: { url: string };
	};
	properties?: Record<string, unknown>;
	created_time?: string;
	last_edited_time?: string;
}

export interface IntegrationStatus {
	status: "connected" | "disconnected" | "syncing" | "error";
	lastSync?: string;
	nextSync?: string;
	syncEnabled?: boolean;
	error?: string;
}

export interface SyncStatistics {
	totalTasks: number;
	syncedTasks: number;
	failedTasks: number;
	lastSyncTime: string;
	syncDuration: number;
	errorCount: number;
}

export interface Integration {
	id: string;
	provider: string;
	syncEnabled: boolean;
	config?: {
		databaseId?: string;
		databaseName?: string;
		importExisting?: boolean;
	};
	lastSyncAt?: string;
}

export interface WorkspaceIntegrationData {
	integration: Integration;
	status: IntegrationStatus;
	stats: SyncStatistics;
}

// API Response types
export interface ApiResponse<T> {
	data: T;
	success: boolean;
	error?: string;
}

export interface DatabasesResponse {
	databases: NotionDatabase[];
}

// Agent Execution types
export interface AgentExecutionStep {
	toolName: string;
	input?: unknown;
	output?: unknown;
	error?: string;
	timestamp: string;
}

export interface AgentExecutionResult {
	action: string;
	reasoning: string;
	tasks?: unknown[];
}

export interface AgentExecutionRecord {
	executionId: string;
	userId: string;
	query: string;
	status: "pending" | "done" | "fail";
	result?: AgentExecutionResult;
	error?: string;
	steps?: AgentExecutionStep[];
	createdAt: string;
	updatedAt: string;
}

export interface ExecuteTaskParams {
	query: string;
	workspaceId: string;
	contextTasks?: unknown[];
}

export interface ExecuteTaskResponse {
	success: boolean;
	executionId: string;
	status: "pending" | "done" | "fail";
}

// Query key factories for consistent cache keys
export const queryKeys = {
	// Databases
	databases: (workspaceId: string) => ["databases", workspaceId] as const,

	// Integrations
	integrations: (workspaceId: string) => ["integrations", workspaceId] as const,
	integration: (integrationId: string) =>
		["integration", integrationId] as const,

	// Status
	integrationStatus: (integrationId: string) =>
		["integration-status", integrationId] as const,
	workspaceStatus: (workspaceId: string) =>
		["workspace-status", workspaceId] as const,

	// Stats
	integrationStats: (integrationId: string) =>
		["integration-stats", integrationId] as const,

	// Agent Executions
	executions: () => ["executions"] as const,
	execution: (executionId: string) => ["execution", executionId] as const,
} as const;
