/**
 * Constants for chat functionality
 */

export const TASK_CREATION_KEYWORDS = [
	"create",
	"add",
	"make",
	"new task",
	"todo",
	"need to",
	"should",
	"must",
	"remind me",
	"schedule",
	"plan",
	"organize",
] as const;

export const QUERY_KEYWORDS = [
	"show",
	"find",
	"list",
	"what",
	"which",
	"search",
	"display",
	"get",
] as const;

export const CHAT_LIMITS = {
	MAX_MESSAGE_LENGTH: 1000,
	MAX_QUERY_RESULTS: 10,
	MAX_HISTORY_MESSAGES: 5,
	TASK_CONFIDENCE_THRESHOLD: 0.3,
} as const;

export const ERROR_MESSAGES = {
	AUTHENTICATION_REQUIRED: "Authentication required or guest ID missing",
	TASK_CREATION_FAILED:
		"I had trouble creating that task. Could you try rephrasing what you'd like to accomplish?",
	TASK_QUERY_FAILED:
		"I had trouble searching your tasks. Could you try rephrasing your question?",
	GENERAL_ERROR: "Failed to process chat message",
	NETWORK_ERROR: "Network error. Please check your connection and try again.",
	AUTH_ERROR: "Authentication error. Please sign in and try again.",
	VALIDATION_ERROR: "Invalid request. Please check your input and try again.",
} as const;

export const SUCCESS_MESSAGES = {
	WELCOME:
		"Hi! I'm your AI task assistant. I can help you create, organize, and manage your tasks. What would you like to work on today?",
	HELP: `I'm here to help you manage your tasks! I can:

• Create new tasks from your descriptions
• Find and organize existing tasks  
• Help you plan and prioritize your work
• Break down complex projects into smaller tasks

What would you like to work on today?`,
	NEED_MORE_INFO:
		"I understand you want to create a task, but I need more specific information. Could you tell me what exactly you'd like to accomplish?",
	NO_TASKS_FOUND:
		"I couldn't find any tasks matching your query. Would you like me to create a new task instead?",
} as const;
