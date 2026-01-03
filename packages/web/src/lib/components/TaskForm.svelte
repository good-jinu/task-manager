<script lang="ts">
	import type { Database } from '$lib/types';
	import { Card, Button } from './ui';

	interface Props {
		databases: Database[];
		loading: boolean;
		error: string;
		onSubmit: (query: string, databaseId: string) => Promise<void>;
		onClear: () => void;
	}

	let { databases, loading, error, onSubmit, onClear }: Props = $props();

	// Form state
	let query = $state('');
	let selectedDatabaseId = $state('');

	async function handleSubmit() {
		if (!query.trim()) {
			return;
		}

		if (!selectedDatabaseId) {
			return;
		}

		await onSubmit(query.trim(), selectedDatabaseId);
		query = '';
		selectedDatabaseId = '';
	}

	function handleClear() {
		query = '';
		selectedDatabaseId = '';
		onClear();
	}
</script>

<Card variant="elevated" class="sticky top-6">
	<h2 class="text-lg font-semibold text-foreground mb-4">Create New Task</h2>
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		<div class="mb-4">
			<label for="query" class="block text-sm font-medium text-foreground mb-2">
				Task Description *
			</label>
			<textarea
				id="query"
				bind:value={query}
				placeholder="Describe your task... (e.g., 'Schedule a meeting with the design team next Tuesday to review the new mockups')"
				class="w-full px-3 py-2 text-sm border border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent resize-none"
				rows="4"
				required
			></textarea>
		</div>

		<div class="mb-6">
			<label for="database" class="block text-sm font-medium text-foreground mb-2">
				Target Database *
			</label>
			<select
				id="database"
				bind:value={selectedDatabaseId}
				class="w-full px-3 py-2 text-sm border border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent"
				required
			>
				<option value="">Select a database...</option>
				{#each databases as database}
					<option value={database.id}>{database.title}</option>
				{/each}
			</select>
			{#if databases.length === 0}
				<p class="text-xs text-muted mt-2">
					No databases available. Please visit the <a href="/tasks" class="text-primary hover:text-primary1 underline">Databases page</a> to connect your Notion databases first.
				</p>
			{/if}
		</div>

		<div class="flex flex-col sm:flex-row gap-3">
			<Button
				type="submit"
				disabled={loading || !query.trim() || !selectedDatabaseId}
				loading={loading}
				variant="primary"
				class="flex-1"
			>
				{loading ? 'Submitting...' : 'Submit Task'}
			</Button>
			<Button
				type="button"
				onclick={handleClear}
				variant="secondary"
			>
				Clear
			</Button>
		</div>
	</form>
</Card>