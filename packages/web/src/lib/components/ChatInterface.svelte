<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import type { ChatMessage } from "../types/chat";
import ChatInput from "./ChatInput.svelte";
import ChatMessageComponent from "./ChatMessage.svelte";
import { EmptyState } from "./ui";

interface Props {
	workspaceId: string;
	onTasksUpdate?: (tasks: Task[]) => void;
}

let { workspaceId, onTasksUpdate }: Props = $props();

let messages = $state<ChatMessage[]>([]);
let input = $state("");
let isLoading = $state(false);
let chatContainer: HTMLDivElement | null = $state(null);

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

// Auto-scroll to bottom when new messages are added
$effect(() => {
	if (chatContainer && messages.length > 0) {
		setTimeout(() => {
			chatContainer?.scrollTo({
				top: chatContainer.scrollHeight,
				behavior: "smooth",
			});
		}, 100);
	}
});

async function handleSendMessage(content: string) {
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
</script>

<div class="flex flex-col h-full bg-background">
	<!-- Chat Messages -->
	<div 
		bind:this={chatContainer}
		class="flex-1 overflow-y-auto scroll-smooth"
	>
		{#if messages.length === 0}
			<div class="h-full flex items-center justify-center p-8">
				<EmptyState
					icon="task"
					title="Start a conversation"
					description="Ask me to create tasks, organize your work, or help with planning."
				/>
			</div>
		{:else}
			<div class="space-y-1">
				{#each messages as message (message.id)}
					<ChatMessageComponent {message} />
				{/each}
			</div>
		{/if}
	</div>

	<!-- Chat Input -->
	<ChatInput
		bind:value={input}
		onSubmit={handleSendMessage}
		{isLoading}
		placeholder="Ask me to create tasks, organize your work, or help with planning..."
	/>
</div>