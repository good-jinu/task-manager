import type { Task } from "@notion-task-manager/db";
import type { ChatMessage } from "../../types/chat";

export function useChatMessages() {
	let messages = $state<ChatMessage[]>([]);
	let isLoading = $state(false);

	// Initialize with welcome message
	$effect(() => {
		if (messages.length === 0) {
			messages = [
				{
					id: "welcome",
					role: "assistant",
					content:
						"Hi! I'm your AI task assistant. I can help you create, organize, and manage your tasks. What would you like to work on today?",
					timestamp: new Date(),
				},
			];
		}
	});

	async function sendMessage(
		content: string,
		workspaceId: string,
		onTasksUpdate?: (tasks: Task[]) => void,
	) {
		if (!content.trim() || isLoading) return;

		const userMessage: ChatMessage = {
			id: Date.now().toString(),
			role: "user",
			content: content.trim(),
			timestamp: new Date(),
		};

		messages = [...messages, userMessage];
		isLoading = true;

		try {
			const response = await fetch("/api/ai/chat", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: content,
					workspaceId,
					history: messages.slice(-5), // Send last 5 messages for context
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to get AI response");
			}

			const data = await response.json();

			const assistantMessage: ChatMessage = {
				id: (Date.now() + 1).toString(),
				role: "assistant",
				content: data.content,
				timestamp: new Date(),
				tasks: data.tasks || [],
			};

			messages = [...messages, assistantMessage];

			// Notify parent about task updates
			if (data.tasks && data.tasks.length > 0 && onTasksUpdate) {
				onTasksUpdate(data.tasks);
			}
		} catch (error) {
			console.error("Error sending message:", error);

			// More specific error handling
			let errorContent = "Sorry, I encountered an error. Please try again.";

			if (error instanceof Error) {
				if (error.message.includes("fetch")) {
					errorContent =
						"Network error. Please check your connection and try again.";
				} else if (error.message.includes("401")) {
					errorContent = "Authentication error. Please sign in and try again.";
				} else if (error.message.includes("400")) {
					errorContent =
						"Invalid request. Please check your input and try again.";
				}
			}

			const errorMessage: ChatMessage = {
				id: (Date.now() + 1).toString(),
				role: "assistant",
				content: errorContent,
				timestamp: new Date(),
			};

			messages = [...messages, errorMessage];
		} finally {
			isLoading = false;
		}
	}

	return {
		get messages() {
			return messages;
		},
		get isLoading() {
			return isLoading;
		},
		sendMessage,
	};
}
