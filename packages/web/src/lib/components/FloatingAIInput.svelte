<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import { Close, Send } from "./icons";

interface Props {
	workspaceId: string;
	selectedTasks: Task[];
	onClearContext?: () => void;
	onTasksUpdate?: (tasks: Task[]) => void;
}

let {
	workspaceId,
	selectedTasks = [],
	onClearContext,
	onTasksUpdate,
}: Props = $props();

let input = $state("");
let isLoading = $state(false);

async function handleSendMessage() {
	if (!input.trim() || isLoading) return;

	const message = input.trim();
	input = "";
	isLoading = true;

	try {
		const response = await fetch("/api/agent/execute-task", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: message,
				workspaceId,
				contextTasks: selectedTasks,
			}),
		});

		const result = await response.json();

		if (result.success) {
			// Update tasks immediately with the result
			if (result.result?.tasks && onTasksUpdate) {
				onTasksUpdate(result.result.tasks);
			}

			// Clear context after sending
			if (onClearContext) {
				onClearContext();
			}
		} else {
			console.error("Task execution failed:", result.error);
		}
	} catch (error) {
		console.error("Failed to execute task:", error);
	} finally {
		isLoading = false;
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		handleSendMessage();
	}
}
</script>

<div class="fixed bottom-4 left-4 right-4 z-50">
	<div class="max-w-4xl mx-auto">
		<!-- Context Tasks Display -->
		{#if selectedTasks.length > 0}
			<div class="mb-2 p-3 bg-accent-icon-bg border border-accent rounded-lg shadow-sm">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium text-accent">AI Context ({selectedTasks.length} tasks)</span>
					<button
						onclick={onClearContext}
						class="text-accent hover:text-accent-button-hover"
						title="Clear context"
					>
						<Close class="w-4 h-4" />
					</button>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each selectedTasks as task (task.id)}
						<div class="flex items-center gap-1 px-2 py-1 bg-surface-base border border-accent rounded text-sm">
							<span class="truncate max-w-32 text-foreground-base">{task.title}</span>
							<button
								onclick={onClearContext}
								class="text-accent hover:text-accent-button-hover ml-1"
								title="Remove from context"
							>
								<Close class="w-3 h-3" />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- AI Input Box -->
		<div class={`bg-surface-base border rounded-lg shadow-lg transition-all duration-200 ${
			selectedTasks.length > 0 ? 'border-accent shadow-accent-icon-bg' : 'border-subtle-base'
		}`}>
			<div class="flex items-end gap-3 p-4">
				<div class="flex-1">
					<textarea
						bind:value={input}
						onkeydown={handleKeydown}
						placeholder={selectedTasks.length > 0 
							? `Ask AI about ${selectedTasks.length} selected task${selectedTasks.length > 1 ? 's' : ''}...`
							: "Ask AI to help with your tasks..."
						}
						class="w-full resize-none border-0 focus:outline-none focus:ring-0 placeholder-muted-foreground text-foreground-base bg-surface-base"
						rows="1"
						style="min-height: 24px; max-height: 120px;"
						disabled={isLoading}
					></textarea>
				</div>
				<button
					onclick={handleSendMessage}
					disabled={!input.trim() || isLoading}
					class="flex-shrink-0 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-button-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if isLoading}
						<div class="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
					{:else}
						<Send class="w-5 h-5" />
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	textarea {
		field-sizing: content;
	}
</style>