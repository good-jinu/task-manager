// Temporary types file to avoid importing private env vars in client code
// This will be replaced when we migrate to the database layer

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

export interface Task {
	id: string;
	title: string;
	description?: string;
	status: TaskStatus;
	priority?: TaskPriority;
	dueDate?: string;
	assignee?: string;
	tags?: string[];
	createdAt?: string;
	updatedAt?: string;
}

export interface CreateTaskInput {
	title: string;
	description?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	dueDate?: string;
	assignee?: string;
	tags?: string[];
}

export interface UpdateTaskInput {
	title?: string;
	description?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	dueDate?: string;
	assignee?: string;
	tags?: string[];
}

export interface TaskFilter {
	status?: TaskStatus;
	priority?: TaskPriority;
	assignee?: string;
	tags?: string[];
}
