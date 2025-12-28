// Task-related enums (duplicated from notion package to avoid circular dependencies)
export enum TaskStatus {
	TODO = "To Do",
	IN_PROGRESS = "In Progress",
	DONE = "Done",
	CANCELLED = "Cancelled",
}

export enum TaskPriority {
	LOW = "Low",
	MEDIUM = "Medium",
	HIGH = "High",
	URGENT = "Urgent",
}

/**
 * User model for DynamoDB storage
 */
export interface User {
	id: string; // Primary key (UUID)
	notionUserId: string; // Notion user ID from OAuth
	email: string; // User email from Notion
	name: string; // Display name
	avatarUrl?: string; // Profile picture URL
	notionAccessToken: string; // Encrypted Notion access token
	createdAt: Date; // Account creation timestamp
	updatedAt: Date; // Last update timestamp
}

/**
 * Task model for DynamoDB storage with user association
 */
export interface Task {
	id: string; // Sort key (UUID)
	userId: string; // Partition key (User ID)
	title: string; // Task title
	description?: string; // Task description
	status: TaskStatus; // Current status
	priority?: TaskPriority; // Task priority
	dueDate?: Date; // Due date
	assignee?: string; // Assigned person
	tags: string[]; // Task tags
	createdAt: Date; // Creation timestamp
	updatedAt: Date; // Last update timestamp
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
}

export interface CreateTaskInput {
	title: string;
	description?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	dueDate?: Date;
	assignee?: string;
	tags?: string[];
}

/**
 * Input types for updating existing records
 */
export interface UpdateUserInput {
	email?: string;
	name?: string;
	avatarUrl?: string;
	notionAccessToken?: string;
}

export interface UpdateTaskInput {
	title?: string;
	description?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	dueDate?: Date;
	assignee?: string;
	tags?: string[];
}

/**
 * Filter types for querying tasks
 */
export interface TaskFilter {
	status?: TaskStatus[];
	priority?: TaskPriority[];
	assignee?: string;
	tags?: string[];
	dueBefore?: Date;
	dueAfter?: Date;
}

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
	// Authentication
	AUTH_SECRET: string;
	AUTH_NOTION_ID: string;
	AUTH_NOTION_SECRET: string;
	AUTH_NOTION_REDIRECT_URI: string;

	// Database
	AWS_REGION: string;
	DYNAMODB_USERS_TABLE: string;
	DYNAMODB_TASKS_TABLE: string;

	// Application
	DOMAIN_NAME: string;
	NODE_ENV: "development" | "staging" | "production";
}
