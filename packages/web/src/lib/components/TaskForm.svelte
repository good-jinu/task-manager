<script lang="ts">
	import type { Database } from '$lib/types';

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

<div class="bg-white shadow-sm rounded-xl border border-gray-200 p-4 sm:p-6 sticky top-6">
	<h2 class="text-lg font-semibold text-gray-900 mb-4">Create New Task</h2>
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		<div class="mb-4">
			<label for="query" class="block text-sm font-medium text-gray-700 mb-2">
				Task Description *
			</label>
			<textarea
				id="query"
				bind:value={query}
				placeholder="Describe your task... (e.g., 'Schedule a meeting with the design team next Tuesday to review the new mockups')"
				class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
				rows="4"
				required
			></textarea>
		</div>

		<div class="mb-6">
			<label for="database" class="block text-sm font-medium text-gray-700 mb-2">
				Target Database *
			</label>
			<select
				id="database"
				bind:value={selectedDatabaseId}
				class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
				required
			>
				<option value="">Select a database...</option>
				{#each databases as database}
					<option value={database.id}>{database.title}</option>
				{/each}
			</select>
			{#if databases.length === 0}
				<p class="text-xs text-gray-500 mt-2">
					No databases available. Please visit the <a href="/tasks" class="text-indigo-600 hover:text-indigo-800 underline">Databases page</a> to connect your Notion databases first.
				</p>
			{/if}
		</div>

		<div class="flex flex-col sm:flex-row gap-3">
			<button
				type="submit"
				disabled={loading || !query.trim() || !selectedDatabaseId}
				class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 text-sm"
			>
				{#if loading}
					<span class="flex items-center justify-center">
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Submitting...
					</span>
				{:else}
					Submit Task
				{/if}
			</button>
			<button
				type="button"
				onclick={handleClear}
				class="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 text-sm"
			>
				Clear
			</button>
		</div>
	</form>
</div>