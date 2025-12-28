export interface Task {
	id: string;
	title: string;
	description?: string;
	status: TaskStatus;
	priority?: TaskPriority;
	dueDate?: Date;
	createdAt: Date;
	updatedAt: Date;
	assignee?: string;
	tags?: string[];
}

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

export interface CreateTaskInput {
	title: string;
	description?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	dueDate?: Date;
	assignee?: string;
	tags?: string[];
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

export interface TaskFilter {
	status?: TaskStatus[];
	priority?: TaskPriority[];
	assignee?: string;
	tags?: string[];
	dueBefore?: Date;
	dueAfter?: Date;
}

export interface DatabaseConfig {
	databaseId: string;
	titleProperty: string;
	statusProperty: string;
	priorityProperty?: string;
	dueDateProperty?: string;
	assigneeProperty?: string;
	tagsProperty?: string;
	descriptionProperty?: string;
}
