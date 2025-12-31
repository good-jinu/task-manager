<script lang="ts">
	import type { PageData } from './$types';

	// Define types locally to avoid import issues
	interface ExecutionStep {
		stepId: string;
		toolName: string;
		input: Record<string, unknown>;
		output?: Record<string, unknown>;
		error?: string;
		timestamp: string;
	}

	interface AgentExecutionResult {
		action: 'created' | 'updated' | 'none';
		pageId?: string;
		pageTitle?: string;
		pageUrl?: string;
		reasoning: string;
	}

	interface AgentExecutionRecord {
		userId: string;
		executionId: string;
		status: 'pending' | 'done' | 'fail';
		query: string;
		databaseId: string;
		steps: ExecutionStep[];
		result?: AgentExecutionResult;
		error?: string;
		createdAt: string;
		updatedAt: string;
	}

	let { data }: { data: PageData } = $props();

	// Form state
	let query = $state('');
	let selectedDatabaseId = $state('');

	// UI state
	let loading = $state(false);
	let error = $state('');
	let expandedExecutions = $state<Set<string>>(new Set());

	// Execution history state - initialize from server data and allow updates
	let localExecutions = $state<AgentExecutionRecord[]>([]);
	let initialized = $state(false);

	// Initialize from server data on first render
	$effect(() => {
		if (!initialized && (data as any).executions) {
			localExecutions = (data as any).executions as AgentExecutionRecord[];
			initialized = true;
		}
	});

	// Use derived for the actual executions to display
	let executions = $derived(localExecutions);

	// Get databases from page data
	let databases = $derived((data as any).databases || []);

	// Check if there are any pending executions
	let hasPendingExecutions = $derived(executions.some(e => e.status === 'pending'));

	// Auto-refresh interval for pending executions
	let autoRefreshInterval: ReturnType<typeof setInterval> | null = null;

	// Start auto-refresh when there are pending executions
	$effect(() => {
		if (hasPendingExecutions && !autoRefreshInterval) {
			autoRefreshInterval = setInterval(() => {
				refreshExecutions();
			}, 10000); // Refresh every 10 seconds
		} else if (!hasPendingExecutions && autoRefreshInterval) {
			clearInterval(autoRefreshInterval);
			autoRefreshInterval = null;
		}

		return () => {
			if (autoRefreshInterval) {
				clearInterval(autoRefreshInterval);
				autoRefreshInterval = null;
			}
		};
	});

	async function handleSubmit() {
		if (!query.trim()) {
			error = 'Please enter a task description';
			return;
		}

		if (!selectedDatabaseId) {
			error = 'Please select a database';
			return;
		}

		try {
			loading = true;
			error = '';

			const response = await fetch('/api/agent/execute', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					query: query.trim(),
					databaseId: selectedDatabaseId
				})
			});

			const result = await response.json();

			if (response.ok && result.success) {
				const newExecution: AgentExecutionRecord = {
					userId: '',
					executionId: result.executionId,
					status: 'pending',
					query: query.trim(),
					databaseId: selectedDatabaseId,
					steps: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				localExecutions = [newExecution, ...localExecutions];
				query = '';
			} else {
				error = result.error || 'Submission failed';
			}
		} catch (err) {
			console.error('Submission error:', err);
			error = 'An error occurred while submitting. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function refreshExecutions() {
		try {
			const response = await fetch('/api/agent/executions?limit=10');
			const result = await response.json();

			if (response.ok && result.executions) {
				localExecutions = result.executions;
			}
		} catch (err) {
			console.error('Failed to refresh executions:', err);
		}
	}

	function clearForm() {
		query = '';
		selectedDatabaseId = '';
		error = '';
	}

	function toggleExpanded(executionId: string) {
		const newSet = new Set(expandedExecutions);
		if (newSet.has(executionId)) {
			newSet.delete(executionId);
		} else {
			newSet.add(executionId);
		}
		expandedExecutions = newSet;
	}

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
		const db = databases.find((d: any) => d.id === databaseId);
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
			case 'search_pages': return 'Search Pages';
			case 'create_page': return 'Create Page';
			case 'update_page': return 'Update Page';
			default: return toolName;
		}
	}
</script>

<svelte:head>
	<title>Task Manager Agent - Notion Task Manager</title>
	<meta name="description" content="AI-powered task management agent that intelligently creates or updates Notion tasks." />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-3xl font-bold mb-2">Task Manager Agent</h1>
		<p class="text-gray-600 mb-8">
			Describe your task in natural language. The agent will search for similar existing tasks and either update them or create a new one.
		</p>

		<!-- Task Submission Form -->
		<div class="bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-8">
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				<div class="mb-6">
					<label for="query" class="block text-sm font-medium text-gray-700 mb-2">
						Task Description *
					</label>
					<textarea
						id="query"
						bind:value={query}
						placeholder="Describe your task... (e.g., 'Schedule a meeting with the design team next Tuesday to review the new mockups')"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						rows="3"
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
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						required
					>
						<option value="">Select a database...</option>
						{#each databases as database}
							<option value={database.id}>{database.title}</option>
						{/each}
					</select>
					{#if databases.length === 0}
						<p class="text-sm text-gray-500 mt-1">
							No databases available. Please visit the <a href="/tasks" class="text-indigo-600 hover:text-indigo-800 underline">Databases page</a> to connect your Notion databases first.
						</p>
					{/if}
				</div>

				<div class="flex gap-4">
					<button
						type="submit"
						disabled={loading || !query.trim() || !selectedDatabaseId}
						class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-md transition-colors duration-200"
					>
						{#if loading}
							<span class="flex items-center">
								<svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
						onclick={clearForm}
						class="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-md transition-colors duration-200"
					>
						Clear
					</button>
				</div>
			</form>
		</div>

		<!-- Error Display -->
		{#if error}
			<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-8">
				<div class="flex items-center">
					<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
					</svg>
					{error}
				</div>
			</div>
		{/if}

		<!-- Execution History Section -->
		<div class="bg-white shadow-md rounded-lg px-8 pt-6 pb-8">
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-xl font-semibold">Execution History</h2>
			</div>

			{#if hasPendingExecutions}
				<div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg mb-4 text-sm">
					<span class="flex items-center">
						<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Auto-refreshing for pending executions...
					</span>
				</div>
			{/if}

			{#if executions.length === 0}
				<div class="text-center py-8">
					<svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
					<h3 class="text-lg font-medium text-gray-900 mb-2">No executions yet</h3>
					<p class="text-gray-500">Submit a task above to get started.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each executions as execution}
						<div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
							<div class="flex justify-between items-start mb-3">
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-lg font-medium text-gray-900 truncate">{execution.query}</span>
										<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getStatusColor(execution.status)}">
											{getStatusIcon(execution.status)} {execution.status}
										</span>
									</div>
									<div class="text-sm text-gray-500">Database: {getDatabaseName(execution.databaseId)}</div>
								</div>
								<div class="text-xs text-gray-400 text-right">{formatDateTime(execution.createdAt)}</div>
							</div>

							{#if execution.status === 'pending'}
								<div class="flex items-center text-yellow-600 text-sm">
									<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Processing...
								</div>
							{/if}

							{#if execution.status === 'fail' && execution.error}
								<div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
									<span class="font-medium">Error:</span> {execution.error}
								</div>
							{/if}

							{#if execution.status === 'done' && execution.result}
								<div class="mt-3 bg-green-50 border border-green-200 rounded p-3">
									<div class="flex items-center justify-between">
										<div>
											<span class="text-sm font-medium text-green-800">{getActionLabel(execution.result.action)}</span>
											{#if execution.result.pageTitle}
												<span class="text-sm text-green-700">: {execution.result.pageTitle}</span>
											{/if}
										</div>
										{#if execution.result.pageUrl}
											<a href={execution.result.pageUrl} target="_blank" rel="noopener noreferrer" class="text-sm text-indigo-600 hover:text-indigo-800">
												Open in Notion →
											</a>
										{/if}
									</div>
									{#if execution.result.reasoning}
										<p class="text-sm text-gray-600 mt-2">{execution.result.reasoning}</p>
									{/if}
								</div>
							{/if}

							{#if execution.steps && execution.steps.length > 0}
								<div class="mt-3">
									<button type="button" onclick={() => toggleExpanded(execution.executionId)} class="text-sm text-indigo-600 hover:text-indigo-800 flex items-center">
										{#if expandedExecutions.has(execution.executionId)}
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

									{#if expandedExecutions.has(execution.executionId)}
										<div class="mt-2 space-y-2">
											{#each execution.steps as step, index}
												<div class="bg-gray-50 rounded p-3 text-sm border-l-4 {step.error ? 'border-red-400' : 'border-indigo-400'}">
													<div class="flex justify-between items-start mb-1">
														<span class="font-medium text-gray-700">{index + 1}. {getToolLabel(step.toolName)}</span>
														<span class="text-xs text-gray-400">{new Date(step.timestamp).toLocaleTimeString()}</span>
													</div>
													{#if step.input && Object.keys(step.input).length > 0}
														<div class="text-xs text-gray-500 mb-1">
															<span class="font-medium">Input:</span> {JSON.stringify(step.input).slice(0, 100)}{JSON.stringify(step.input).length > 100 ? '...' : ''}
														</div>
													{/if}
													{#if step.output && Object.keys(step.output).length > 0}
														<div class="text-xs text-gray-500">
															<span class="font-medium">Output:</span> {JSON.stringify(step.output).slice(0, 100)}{JSON.stringify(step.output).length > 100 ? '...' : ''}
														</div>
													{/if}
													{#if step.error}
														<div class="text-xs text-red-600 mt-1"><span class="font-medium">Error:</span> {step.error}</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
