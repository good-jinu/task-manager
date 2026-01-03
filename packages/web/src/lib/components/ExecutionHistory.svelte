<script lang="ts">
	import ExecutionItem from './ExecutionItem.svelte';
	import { Card, Badge, EmptyState } from './ui';
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

<Card variant="elevated">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
		<h2 class="text-lg font-semibold text-foreground mb-2 sm:mb-0">Execution History</h2>
		{#if hasPendingExecutions}
			<Badge variant="warning" class="flex items-center">
				<svg class="animate-spin h-3 w-3 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Auto-refreshing...
			</Badge>
		{/if}
	</div>

	{#if executions.length === 0}
		<EmptyState
			icon="task"
			title="No executions yet"
			description="Submit a task to get started."
		/>
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
</Card>