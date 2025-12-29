// Export main database client

export { getDynamoDBClient, getTableNames } from "./client.js";
export { DatabaseClient, getDatabaseClient } from "./database.js";
export { TaskService } from "./task-service.js";
// Export all types
export type {
	CreateTaskInput,
	CreateUserInput,
	Task,
	TaskFilter,
	UpdateTaskInput,
	UpdateUserInput,
	User,
} from "./types.js";
// Re-export enums for convenience
export { TaskPriority, TaskStatus } from "./types.js";
// Export services for direct use if needed
export { UserService } from "./user-service.js";
// Export validation utilities
export { ValidationError } from "./validation.js";
