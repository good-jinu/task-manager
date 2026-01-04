<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Sparkles, Spinner, Plus } from './icons';

	const dispatch = createEventDispatcher();

	// Component state
	let input = $state('');
	let isSubmitting = $state(false);
	let showAdvanced = $state(false);
	let priority = $state('medium');
	let dueDate = $state('');

	async function handleSubmit() {
		if (!input.trim() || isSubmitting) return;

		try {
			isSubmitting = true;

			const taskData = {
				title: input.trim(),
				priority: priority !== 'medium' ? priority : undefined,
				dueDate: dueDate || undefined
			};

			const response = await fetch('/api/tasks', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(taskData)
			});

			const data = await response.json();

			if (response.ok) {
				dispatch('taskCreated', data.task);
				input = '';
				priority = 'medium';
				dueDate = '';
				showAdvanced = false;
			} else {
				dispatch('error', data.error || 'Failed to create task');
			}
		} catch (err) {
			dispatch('error', 'Failed to create task');
			console.error('Error creating task:', err);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleAIAssist() {
		if (!input.trim()) return;

		try {
			const response = await fetch('/api/ai/parse-task', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ input: input.trim() })
			});

			const data = await response.json();

			if (response.ok && data.task) {
				// Update form with AI suggestions
				if (data.task.priority) priority = data.task.priority;
				if (data.task.dueDate) dueDate = data.task.dueDate;
				if (data.task.title && data.task.title !== input.trim()) {
					input = data.task.title;
				}
				showAdvanced = true;
			}
		} catch (err) {
			console.error('AI assist error:', err);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	}
</script>

<div class="bg-card-bg border border-subtle-base rounded-xl p-4">
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		<!-- Main Input -->
		<div class="flex gap-2 mb-3">
			<div class="flex-1">
				<textarea
					bind:value={input}
					onkeydown={handleKeydown}
					placeholder="What needs to be done? (Press Enter to create, Shift+Enter for new line)"
					class="w-full px-3 py-2 border border-subtle-base rounded-lg bg-surface-base text-foreground-base placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
					rows="2"
					disabled={isSubmitting}
				></textarea>
			</div>
			
			<!-- AI Assist Button -->
			<button
				type="button"
				onclick={handleAIAssist}
				class="px-3 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors flex items-center justify-center min-w-[44px] min-h-[44px]"
				title="AI Assist"
				disabled={!input.trim() || isSubmitting}
			>
				<Sparkles class="w-5 h-5" />
			</button>
		</div>

		<!-- Advanced Options Toggle -->
		<div class="flex items-center justify-between mb-3">
			<button
				type="button"
				onclick={() => showAdvanced = !showAdvanced}
				class="text-sm text-foreground-secondary hover:text-foreground-base transition-colors"
			>
				{showAdvanced ? 'Hide' : 'Show'} advanced options
			</button>
			
			<!-- Submit Button -->
			<button
				type="submit"
				disabled={!input.trim() || isSubmitting}
				class="px-4 py-2 bg-primary hover:bg-primary-button-hover disabled:bg-subtle-base disabled:text-muted-foreground text-primary-foreground rounded-lg transition-colors flex items-center gap-2 min-h-[44px]"
			>
				{#if isSubmitting}
					<Spinner class="w-4 h-4" />
					Creating...
				{:else}
					<Plus class="w-4 h-4" />
					Create Task
				{/if}
			</button>
		</div>

		<!-- Advanced Options -->
		{#if showAdvanced}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-subtle-base">
				<!-- Priority -->
				<div>
					<label for="priority" class="block text-sm font-medium text-foreground-base mb-1">
						Priority
					</label>
					<select
						id="priority"
						bind:value={priority}
						class="w-full px-3 py-2 border border-subtle-base rounded-lg bg-surface-base text-foreground-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
						disabled={isSubmitting}
					>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
						<option value="urgent">Urgent</option>
					</select>
				</div>

				<!-- Due Date -->
				<div>
					<label for="dueDate" class="block text-sm font-medium text-foreground-base mb-1">
						Due Date
					</label>
					<input
						id="dueDate"
						type="date"
						bind:value={dueDate}
						class="w-full px-3 py-2 border border-subtle-base rounded-lg bg-surface-base text-foreground-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
						disabled={isSubmitting}
					/>
				</div>
			</div>
		{/if}
	</form>
</div>