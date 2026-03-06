<script lang="ts">
import type { Task } from "@task-manager/db";
import {
	refreshExecutions,
	refreshTasks,
	useExecuteTask,
	useExecution,
} from "$lib/queries";
import { Close, Send } from "./icons";
import { cn } from "./utils";

interface Props {
	workspaceId: string;
	selectedTasks: Task[];
	onClearContext?: () => void;
}

let { workspaceId, selectedTasks = [], onClearContext }: Props = $props();

let input = $state("");
let currentExecutionId = $state<string | undefined>(undefined);

// Mutation for executing tasks
const executeTaskMutation = useExecuteTask();

// Query for polling execution status - reactive to currentExecutionId
let executionQuery = $derived(useExecution(currentExecutionId));

// Watch for execution completion
$effect(() => {
	const execution = executionQuery.data;
	const execId = currentExecutionId;

	if (execution && execId) {
		if (execution.status === "done") {
			// Execution completed successfully
			console.log("Task execution completed:", execution);

			// Refresh tasks using query invalidation
			refreshTasks(workspaceId);

			// Refresh executions list to show updated status
			refreshExecutions();

			// Clear context after completion
			if (onClearContext) {
				onClearContext();
			}

			// Reset execution ID to stop polling
			currentExecutionId = undefined;
		} else if (execution.status === "fail") {
			// Execution failed
			console.error("Task execution failed:", execution.error);

			// Refresh executions list to show failed status
			refreshExecutions();

			// Reset execution ID to stop polling
			currentExecutionId = undefined;
		}
	}
});

async function handleSendMessage() {
	if (!input.trim() || executeTaskMutation.isPending) return;

	const message = input.trim();
	input = "";

	console.log("Sending task to agent with workspaceId:", workspaceId);

	try {
		const result = await executeTaskMutation.mutateAsync({
			query: message,
			workspaceId,
			contextTasks: selectedTasks,
		});

		console.log("Agent execution started:", result);

		// Start polling by setting the execution ID
		if (result.executionId) {
			currentExecutionId = result.executionId;
		}
	} catch (error) {
		console.error("Failed to execute task:", error);
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		handleSendMessage();
	}
}

const isLoading = $derived(
	executeTaskMutation.isPending || executionQuery.data?.status === "pending",
);
</script>

<div class="fixed bottom-6 left-4 right-4 z-[100]" data-tour="ai-input">
	<div class="max-w-4xl mx-auto">
		<!-- Context Tasks Display -->
		{#if selectedTasks.length > 0}
			<div class="mb-3 p-4 bg-accent/5 backdrop-blur-md border border-accent/20 rounded-2xl shadow-xl animate-in slide-in-from-bottom-2 duration-300">
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
						<span class="text-xs font-bold uppercase tracking-wider text-accent">Active Context ({selectedTasks.length})</span>
					</div>
					<button
						onclick={onClearContext}
						class="p-1 rounded-full text-accent hover:bg-accent/10 transition-colors"
						title="Clear context"
					>
						<Close class="w-4 h-4" />
					</button>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each selectedTasks as task (task.id)}
						<div class="flex items-center gap-2 px-3 py-1.5 bg-surface-base border border-accent/10 rounded-xl text-xs font-medium shadow-sm">
							<span class="truncate max-w-32 text-foreground-base">{task.title}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- AI Input Box -->
		<div class={cn(
			'relative bg-surface-base border rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden',
			selectedTasks.length > 0 ? 'border-accent shadow-accent/10' : 'border-subtle-base hover:border-primary/20'
		)}>
			{#if isLoading}
				<div class="absolute inset-0 bg-surface-base/50 backdrop-blur-[1px] flex items-center justify-center z-10">
					<div class="flex items-center gap-3 px-4 py-2 bg-white rounded-full shadow-lg border border-subtle-base">
						<div class="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
						<span class="text-sm font-bold text-primary animate-pulse">AI is thinking...</span>
					</div>
				</div>
			{/if}

			<div class="flex items-end gap-3 p-4">
				<div class="flex-1">
					<textarea
						bind:value={input}
						onkeydown={handleKeydown}
						placeholder={selectedTasks.length > 0 
							? `How can I help with these ${selectedTasks.length} tasks?`
							: "Type a request for your AI assistant..."
						}
						class="w-full resize-none border-0 focus:outline-none focus:ring-0 placeholder-muted-foreground text-foreground-base bg-transparent py-2 leading-relaxed"
						rows="1"
						style="min-height: 40px; max-height: 200px;"
						disabled={isLoading}
					></textarea>
				</div>
				<button
					onclick={handleSendMessage}
					disabled={!input.trim() || isLoading}
					class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-xl hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all duration-200 active:scale-90 shadow-lg shadow-primary/20"
				>
					<Send class="w-5 h-5" />
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
