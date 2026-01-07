import type { Task } from "@notion-task-manager/db";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
	tasks?: Task[];
}

export interface TaskSuggestion {
	title: string;
	content?: string;
	priority?: string;
	dueDate?: string;
	reasoning?: string;
}

export interface TaskCreationData {
	title: string;
	content?: string;
	priority?: "low" | "medium" | "high" | "urgent";
	dueDate?: string;
	workspaceId: string;
}

export interface AIResponse {
	content: string;
	tasks?: Task[];
	suggestions?: TaskSuggestion[];
}
