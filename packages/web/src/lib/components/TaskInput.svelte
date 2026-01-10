<script lang="ts">
import type { CreateTaskInput, TaskPriority } from "@notion-task-manager/db";
import { Sparkles, Spinner } from "./icons";
import { Button } from "./ui";
import { cn } from "./utils";

interface Props {
	workspaceId: string;
	onSubmit: (input: CreateTaskInput) => Promise<void>;
	onAIAssist?: (input: string) => Promise<CreateTaskInput | null>;
	placeholder?: string;
	class?: string;
}

let {
	workspaceId,
	onSubmit,
	onAIAssist,
	placeholder = "What needs to be done?",
	class: className = "",
}: Props = $props();

let input = $state("");
let priority = $state<TaskPriority | undefined>(undefined);
let dueDate = $state("");
let isSubmitting = $state(false);
let isAIProcessing = $state(false);
let showAdvanced = $state(false);

async function handleSubmit() {
	if (!input.trim() || isSubmitting) return;

	isSubmitting = true;
	try {
		const taskInput: CreateTaskInput = {
			workspaceId,
			title: input.trim(),
			priority: priority || undefined,
			dueDate: dueDate || undefined,
		};

		await onSubmit(taskInput);

		// Reset form
		input = "";
		priority = undefined;
		dueDate = "";
		showAdvanced = false;
	} finally {
		isSubmitting = false;
	}
}

async function handleAIAssist() {
	if (!onAIAssist || !input.trim() || isAIProcessing) return;

	isAIProcessing = true;
	try {
		const aiResult = await onAIAssist(input.trim());
		if (aiResult) {
			// Update form with AI suggestions
			input = aiResult.title;
			priority = aiResult.priority;
			dueDate = aiResult.dueDate || "";
			showAdvanced = !!(aiResult.priority || aiResult.dueDate);

			// Show a brief success indicator
			setTimeout(() => {
				// Could add a toast notification here
			}, 100);
		}
	} catch (error) {
		console.error("AI assist failed:", error);
		// Could show error toast here
	} finally {
		isAIProcessing = false;
	}
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		handleSubmit();
	}
}

// Auto-resize textarea
function autoResize(textarea: HTMLTextAreaElement) {
	textarea.style.height = "auto";
	textarea.style.height = `${textarea.scrollHeight}px`;
}

const priorities: { value: TaskPriority; label: string; color: string }[] = [
	{ value: "low", label: "Low", color: "text-info" },
	{ value: "medium", label: "Medium", color: "text-warning" },
	{ value: "high", label: "High", color: "text-error" },
	{ value: "urgent", label: "Urgent", color: "text-error" },
];
</script>

<div class={cn('bg-surface-base border border-subtle-base rounded-lg p-4', className)}>
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		<!-- Main input area -->
		<div class="relative">
			<textarea
				bind:value={input}
				onkeydown={handleKeydown}
				oninput={(e) => autoResize(e.currentTarget)}
				{placeholder}
				class={cn(
					'w-full px-0 py-2 text-base border-none resize-none',
					'focus:outline-none focus:ring-0',
					'placeholder:text-muted-foreground',
					'bg-transparent text-foreground-base',
					'min-h-[44px]' // Ensure minimum touch target
				)}
				rows="1"
				required
			></textarea>

			<!-- AI assist button -->
			{#if onAIAssist}
				<button
					type="button"
					onclick={handleAIAssist}
					disabled={!input.trim() || isAIProcessing}
					class={cn(
						'absolute right-0 top-2 p-2 rounded-md',
						'text-accent hover:bg-accent-icon-bg',
						'disabled:opacity-50 disabled:cursor-not-allowed',
						'min-w-[44px] min-h-[44px] flex items-center justify-center'
					)}
					aria-label="Get AI assistance"
					title="Get AI assistance for this task"
				>
					{#if isAIProcessing}
						<Spinner class="w-5 h-5" />
					{:else}
						<Sparkles class="w-5 h-5" />
					{/if}
				</button>
			{/if}
		</div>

		<!-- Advanced options toggle -->
		<div class="mt-3 flex items-center justify-between">
			<button
				type="button"
				onclick={() => showAdvanced = !showAdvanced}
				class="text-sm text-muted-foreground hover:text-foreground-base min-h-[44px] px-2"
			>
				{showAdvanced ? 'Hide' : 'Show'} options
			</button>

			<div class="flex items-center gap-2">
				<Button
					type="submit"
					disabled={!input.trim() || isSubmitting}
					loading={isSubmitting}
					size="sm"
					variant="primary"
				>
					Add Task
				</Button>
			</div>
		</div>

		<!-- Advanced options -->
		{#if showAdvanced}
			<div class="mt-4 pt-4 border-t border-subtle-base space-y-4">
				<!-- Priority selection -->
				<fieldset>
					<legend class="block text-sm font-medium text-foreground-base mb-2">
						Priority
					</legend>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							onclick={() => priority = undefined}
							class={cn(
								'px-3 py-1.5 text-sm rounded-md border min-h-[44px]',
								!priority 
									? 'bg-surface-muted border-subtle-base text-foreground-base' 
									: 'bg-surface-base border-subtle-base text-muted-foreground hover:bg-surface-muted'
							)}
						>
							None
						</button>
						{#each priorities as p}
							<button
								type="button"
								onclick={() => priority = p.value}
								class={cn(
									'px-3 py-1.5 text-sm rounded-md border min-h-[44px]',
									priority === p.value
										? 'bg-surface-muted border-subtle-base text-foreground-base'
										: 'bg-surface-base border-subtle-base hover:bg-surface-muted',
									p.color
								)}
							>
								{p.label}
							</button>
						{/each}
					</div>
				</fieldset>

				<!-- Due date -->
				<div>
					<label for="due-date" class="block text-sm font-medium text-foreground-base mb-2">
						Due Date
					</label>
					<input
						id="due-date"
						type="date"
						bind:value={dueDate}
						class={cn(
							'px-3 py-2 border border-subtle-base rounded-md',
							'bg-surface-base text-foreground-base',
							'focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent',
							'min-h-[44px] text-sm'
						)}
					/>
				</div>
			</div>
		{/if}
	</form>
</div>