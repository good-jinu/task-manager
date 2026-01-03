<script lang="ts">
	import ExecutionItem from './ExecutionItem.svelte';
	import type { AgentExecutionRecord, Database } from '$lib/types';

	interface Props {
		executions: AgentExecutionRecord[];
		databases: Database[];
		hasPendingExecutions: boolean;
		expandedExecutions: Set<string>;
		onToggleExpanded: (executionId: string) => void;
	}

	let { executions, databases, hasPendingExecutions, expandedExecutions, onToggleExpanded }: Props = $props();
</script>

<div class="bg-white shadow-sm rounded-xl border border-gray-200 p-4 sm:p-6">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">Execution History</h2>
		{#if hasPendingExecutions}
			<div class="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-xs">
				<span class="flex items-center">
					<svg class="animate-spin h-3 w-3 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Auto-refreshing...
				</span>
			</div>
		{/if}
	</div>

	{#if executions.length === 0}
		<div class="text-center py-12">
			<svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
			</svg>
			<h3 class="text-lg font-medium text-gray-900 mb-2">No executions yet</h3>
			<p class="text-gray-500 text-sm">Submit a task to get started.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each executions as execution}
				<ExecutionItem 
					{execution} 
					{databases} 
					expanded={expandedExecutions.has(execution.executionId)}
					onToggleExpanded={() => onToggleExpanded(execution.executionId)}
				/>
			{/each}
		</div>
	{/if}
</div>