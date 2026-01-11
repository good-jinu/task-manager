/**
 * Task status enumeration
 */
export type TaskStatus = "todo" | "in-progress" | "done" | "archived";

/**
 * Task priority enumeration
 */
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/**
 * Individual step taken by the agent during execution
 */
export interface ExecutionStep {
	stepId: string;
	toolName: string;
	input: Record<string, unknown>;
	output?: Record<string, unknown>;
	error?: string;
	timestamp: string;
}

/**
 * Task model interface
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
 * Task service interface that defines the contract for task operations
 */
export interface TaskService {
	/**
	 * Creates a new task in the database
	 */
	createTask(taskData: CreateTaskInput): Promise<Task>;

	/**
	 * Retrieves a task by its ID
	 */
	getTask(taskId: string): Promise<Task | null>;

	/**
	 * Updates an existing task
	 */
	updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task>;

	/**
	 * Deletes a task by its ID
	 */
	deleteTask(taskId: string): Promise<void>;

	/**
	 * Lists tasks for a workspace with pagination
	 */
	listTasks(
		workspaceId: string,
		options?: ListTasksOptions,
	): Promise<PaginatedResult<Task>>;

	/**
	 * Lists tasks by status within a workspace
	 */
	listTasksByStatus(
		workspaceId: string,
		status: TaskStatus,
		options?: ListTasksOptions,
	): Promise<PaginatedResult<Task>>;
}
