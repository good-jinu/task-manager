<script lang="ts">
	import type { CreateTaskInput, TaskPriority } from '@notion-task-manager/db';
	import { Button } from './ui';
	import { Sparkles, Spinner } from './icons';
	import { cn } from './utils';

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
		class: className = ''
	}: Props = $props();

	let input = $state('');
	let priority = $state<TaskPriority | undefined>(undefined);
	let dueDate = $state('');
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
				dueDate: dueDate || undefined
			};

			await onSubmit(taskInput);
			
			// Reset form
			input = '';
			priority = undefined;
			dueDate = '';
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
				dueDate = aiResult.dueDate || '';
				showAdvanced = !!(aiResult.priority || aiResult.dueDate);
				
				// Show a brief success indicator
				setTimeout(() => {
					// Could add a toast notification here
				}, 100);
			}
		} catch (error) {
			console.error('AI assist failed:', error);
			// Could show error toast here
		} finally {
			isAIProcessing = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	// Auto-resize textarea
	function autoResize(textarea: HTMLTextAreaElement) {
		textarea.style.height = 'auto';
		textarea.style.height = textarea.scrollHeight + 'px';
	}

	const priorities: { value: TaskPriority; label: string; color: string }[] = [
		{ value: 'low', label: 'Low', color: 'text-blue-600' },
		{ value: 'medium', label: 'Medium', color: 'text-yellow-600' },
		{ value: 'high', label: 'High', color: 'text-orange-600' },
		{ value: 'urgent', label: 'Urgent', color: 'text-red-600' }
	];
</script>

<div class={cn('bg-white border border-gray-200 rounded-lg p-4', className)}>
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
					'placeholder:text-gray-400',
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
						'text-purple-600 hover:bg-purple-50',
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
				class="text-sm text-gray-500 hover:text-gray-700 min-h-[44px] px-2"
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
			<div class="mt-4 pt-4 border-t border-gray-100 space-y-4">
				<!-- Priority selection -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Priority
					</label>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							onclick={() => priority = undefined}
							class={cn(
								'px-3 py-1.5 text-sm rounded-md border min-h-[44px]',
								!priority 
									? 'bg-gray-100 border-gray-300 text-gray-900' 
									: 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
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
										? 'bg-gray-100 border-gray-300 text-gray-900'
										: 'bg-white border-gray-200 hover:bg-gray-50',
									p.color
								)}
							>
								{p.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Due date -->
				<div>
					<label for="due-date" class="block text-sm font-medium text-gray-700 mb-2">
						Due Date
					</label>
					<input
						id="due-date"
						type="date"
						bind:value={dueDate}
						class={cn(
							'px-3 py-2 border border-gray-200 rounded-md',
							'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
							'min-h-[44px] text-sm'
						)}
					/>
				</div>
			</div>
		{/if}
	</form>
</div>