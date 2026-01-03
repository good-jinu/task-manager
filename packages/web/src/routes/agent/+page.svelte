<script lang="ts">
	import type { PageData } from './$types';
	import { TaskForm, ExecutionHistory, ErrorAlert } from '$lib/components';
	import type { AgentExecutionRecord } from '$lib/types';

	let { data }: { data: PageData } = $props();

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

	async function handleTaskSubmit(query: string, databaseId: string) {
		try {
			loading = true;
			error = '';

			const response = await fetch('/api/agent/execute', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					query: query,
					databaseId: databaseId
				})
			});

			const result = await response.json();

			if (response.ok && result.success) {
				const newExecution: AgentExecutionRecord = {
					userId: '',
					executionId: result.executionId,
					status: 'pending',
					query: query,
					databaseId: databaseId,
					steps: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				localExecutions = [newExecution, ...localExecutions];
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

	function handleClearForm() {
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
</script>

<svelte:head>
	<title>Task Manager Agent - Notion Task Manager</title>
	<meta name="description" content="AI-powered task management agent that intelligently creates or updates Notion tasks." />
</svelte:head>

<div class="min-h-screen bg-background">
	<div class="container mx-auto px-4 py-6 sm:py-8">
		<div class="max-w-6xl mx-auto">
			<!-- Header -->
			<div class="text-center mb-8">
				<h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">Task Manager Agent</h1>
				<p class="text-foreground-secondary text-sm sm:text-base max-w-2xl mx-auto">
					Describe your task in natural language. The agent will search for similar existing tasks and either update them or create a new one.
				</p>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
				<!-- Task Submission Form - Left Column -->
				<div class="lg:col-span-1">
					<TaskForm 
						{databases} 
						{loading} 
						{error} 
						onSubmit={handleTaskSubmit} 
						onClear={handleClearForm} 
					/>
				</div>

				<!-- Error Display and Execution History - Right Column -->
				<div class="lg:col-span-2">
					<ErrorAlert {error} />
					<ExecutionHistory 
						{executions} 
						{databases} 
						{hasPendingExecutions} 
						{expandedExecutions} 
						onToggleExpanded={toggleExpanded} 
					/>
				</div>
			</div>
		</div>
	</div>
</div>
