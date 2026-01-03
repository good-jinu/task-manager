<script lang="ts">
	import type { AgentExecutionRecord, Database } from '$lib/types';
	import { marked } from 'marked';
	import { Card, Badge, Alert, LoadingSpinner, Button } from './ui';

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

	function getStatusVariant(status: string): 'warning' | 'success' | 'error' | 'default' {
		switch (status) {
			case 'pending': return 'warning';
			case 'done': return 'success';
			case 'fail': return 'error';
			default: return 'default';
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

<Card hover class="p-4">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
		<div class="flex-1 min-w-0">
			<div class="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
				<h3 class="text-sm font-medium text-foreground truncate pr-2">{execution.query}</h3>
				<Badge variant={getStatusVariant(execution.status)} class="flex-shrink-0">
					{getStatusIcon(execution.status)} {execution.status}
				</Badge>
			</div>
			<div class="text-xs text-muted mb-1">Database: {getDatabaseName(execution.databaseId)}</div>
		</div>
		<div class="text-xs text-muted-foreground flex-shrink-0">{formatDateTime(execution.createdAt)}</div>
	</div>

	{#if execution.status === 'pending'}
		<LoadingSpinner size="sm" text="Processing..." class="mb-3" />
	{/if}

	{#if execution.status === 'fail' && execution.error}
		<Alert variant="error" class="mb-3">
			<span class="font-medium">Error:</span> 
			<span class="break-words">{execution.error}</span>
		</Alert>
	{/if}

	{#if execution.status === 'done' && execution.result}
		<Alert variant="success" class="mb-3">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<div class="min-w-0">
					<span class="text-sm font-medium">{getActionLabel(execution.result.action)}</span>
					{#if execution.result.pageTitle}
						<span class="text-sm break-words">: {execution.result.pageTitle}</span>
					{/if}
				</div>
				{#if execution.result.pageUrl}
					<Button href={execution.result.pageUrl} variant="primary" size="sm" class="flex-shrink-0">
						Open in Notion →
					</Button>
				{/if}
			</div>
			{#if execution.result.reasoning}
				<div class="text-sm mt-2 break-words prose prose-sm max-w-none">
					{@html marked(execution.result.reasoning)}
				</div>
			{/if}
		</Alert>
	{/if}

	{#if execution.steps && execution.steps.length > 0}
		<div>
			<Button variant="outline" size="sm" onclick={onToggleExpanded} class="text-primary hover:text-primary1">
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
			</Button>

			{#if expanded}
				<div class="mt-3 space-y-2">
					{#each execution.steps as step, index}
						<Card padding="sm" class="text-sm border-l-4 {step.error ? 'border-error1' : 'border-primary1'}">
							<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1">
								<span class="font-medium text-foreground1">{index + 1}. {getToolLabel(step.toolName)}</span>
								<span class="text-xs text-muted-foreground">{new Date(step.timestamp).toLocaleTimeString()}</span>
							</div>
							{#if step.input && Object.keys(step.input).length > 0}
								<div class="text-xs text-foreground-secondary mb-1 break-all">
									<span class="font-medium">Input:</span> {JSON.stringify(step.input).slice(0, 100)}{JSON.stringify(step.input).length > 100 ? '...' : ''}
								</div>
							{/if}
							{#if step.output && Object.keys(step.output).length > 0}
								<div class="text-xs text-foreground-secondary break-all">
									<span class="font-medium">Output:</span> {JSON.stringify(step.output).slice(0, 100)}{JSON.stringify(step.output).length > 100 ? '...' : ''}
								</div>
							{/if}
							{#if step.error}
								<div class="text-xs text-error mt-1 break-words"><span class="font-medium">Error:</span> {step.error}</div>
							{/if}
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</Card>