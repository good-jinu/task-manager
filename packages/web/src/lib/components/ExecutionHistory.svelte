<script lang="ts">
	import ExecutionItem from './ExecutionItem.svelte';
	import { Card, Badge, EmptyState } from './ui';
	import { Spinner } from '$lib/components/icons';
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
				<Spinner class="h-3 w-3 mr-2" />
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