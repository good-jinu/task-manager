<script lang="ts">
	import type { AgentExecutionRecord, Database } from '$lib/types';

	interface Props {
		execution: AgentExecutionRecord;
		databases: Database[];
		expanded: boolean;
		onToggleExpanded: () => void;
	}

	let { execution, databases, expanded, onToggleExpanded }: Props = $props();

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'pending': return 'bg-yellow-100 text-yellow-800';
			case 'done': return 'bg-green-100 text-green-800';
			case 'fail': return 'bg-red-100 text-red-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	}

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'pending': return '⏳';
			case 'done': return '✓';
			case 'fail': return '✗';
			default: return '?';
		}
	}

	function getDatabaseName(databaseId: string): string {
		const db = databases.find((d: Database) => d.id === databaseId);
		return db?.title || 'Unknown Database';
	}

	function getActionLabel(action: string): string {
		switch (action) {
			case 'created': return 'Created new page';
			case 'updated': return 'Updated existing page';
			case 'none': return 'No action taken';
			default: return action;
		}
	}

	function getToolLabel(toolName: string): string {
		switch (toolName) {
			case 'executeSearchPages': return 'Search Pages';
			case 'executeCreatePage': return 'Create Page';
			case 'executeUpdatePage': return 'Update Page';
			case 'search_pages': return 'Search Pages';
			case 'create_page': return 'Create Page';
			case 'update_page': return 'Update Page';
			default: return toolName;
		}
	}
</script>

<div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
		<div class="flex-1 min-w-0">
			<div class="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
				<h3 class="text-sm font-medium text-gray-900 truncate pr-2">{execution.query}</h3>
				<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {getStatusColor(execution.status)} flex-shrink-0">
					{getStatusIcon(execution.status)} {execution.status}
				</span>
			</div>
			<div class="text-xs text-gray-500 mb-1">Database: {getDatabaseName(execution.databaseId)}</div>
		</div>
		<div class="text-xs text-gray-400 flex-shrink-0">{formatDateTime(execution.createdAt)}</div>
	</div>

	{#if execution.status === 'pending'}
		<div class="flex items-center text-yellow-600 text-sm mb-3">
			<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
			Processing...
		</div>
	{/if}

	{#if execution.status === 'fail' && execution.error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
			<span class="font-medium">Error:</span> 
			<span class="break-words">{execution.error}</span>
		</div>
	{/if}

	{#if execution.status === 'done' && execution.result}
		<div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<div class="min-w-0">
					<span class="text-sm font-medium text-green-800">{getActionLabel(execution.result.action)}</span>
					{#if execution.result.pageTitle}
						<span class="text-sm text-green-700 break-words">: {execution.result.pageTitle}</span>
					{/if}
				</div>
				{#if execution.result.pageUrl}
					<a href={execution.result.pageUrl} target="_blank" rel="noopener noreferrer" class="text-sm text-indigo-600 hover:text-indigo-800 flex-shrink-0">
						Open in Notion →
					</a>
				{/if}
			</div>
			{#if execution.result.reasoning}
				<p class="text-sm text-gray-600 mt-2 break-words">{execution.result.reasoning}</p>
			{/if}
		</div>
	{/if}

	{#if execution.steps && execution.steps.length > 0}
		<div>
			<button type="button" onclick={onToggleExpanded} class="text-sm text-indigo-600 hover:text-indigo-800 flex items-center">
				{#if expanded}
					<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
					</svg>
					Hide steps ({execution.steps.length})
				{:else}
					<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
					</svg>
					Show steps ({execution.steps.length})
				{/if}
			</button>

			{#if expanded}
				<div class="mt-3 space-y-2">
					{#each execution.steps as step, index}
						<div class="bg-gray-50 rounded-lg p-3 text-sm border-l-4 {step.error ? 'border-red-400' : 'border-indigo-400'}">
							<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1">
								<span class="font-medium text-gray-700">{index + 1}. {getToolLabel(step.toolName)}</span>
								<span class="text-xs text-gray-400">{new Date(step.timestamp).toLocaleTimeString()}</span>
							</div>
							{#if step.input && Object.keys(step.input).length > 0}
								<div class="text-xs text-gray-500 mb-1 break-all">
									<span class="font-medium">Input:</span> {JSON.stringify(step.input).slice(0, 100)}{JSON.stringify(step.input).length > 100 ? '...' : ''}
								</div>
							{/if}
							{#if step.output && Object.keys(step.output).length > 0}
								<div class="text-xs text-gray-500 break-all">
									<span class="font-medium">Output:</span> {JSON.stringify(step.output).slice(0, 100)}{JSON.stringify(step.output).length > 100 ? '...' : ''}
								</div>
							{/if}
							{#if step.error}
								<div class="text-xs text-red-600 mt-1 break-words"><span class="font-medium">Error:</span> {step.error}</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>