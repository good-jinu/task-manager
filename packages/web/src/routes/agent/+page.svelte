<script lang="ts">
import type { AgentExecutionRecord } from "@notion-task-manager/db";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { ErrorAlert, ExecutionHistory, TaskForm } from "$lib/components";
import AccountCreationDialog from "$lib/components/AccountCreationDialog.svelte";
import GuestBanner from "$lib/components/GuestBanner.svelte";
import {
	checkExistingGuest,
	getGuestTaskCount,
	guestUser,
	isGuestMode,
	migrateGuestTasks,
	registerGuestUser,
} from "$lib/stores/guest";
import type { PageData } from "$lib/types/page-data";

let { data }: { data: PageData } = $props();

// UI state
let loading = $state(false);
let error = $state("");
let expandedExecutions = $state<Set<string>>(new Set());
let showAccountDialog = $state(false);
let guestTaskCount = $state(0);

// Execution history state - initialize from server data and allow updates
let localExecutions = $state<AgentExecutionRecord[]>([]);
let initialized = $state(false);

// Check authentication status
let isAuthenticated = $derived(data.isAuthenticated || false);
let showGuestPrompt = $derived(!isAuthenticated && !$isGuestMode);

// Initialize from server data on first render
$effect(() => {
	if (!initialized && data.executions) {
		localExecutions = data.executions;
		initialized = true;
	}
});

// Use derived for the actual executions to display
let executions = $derived(localExecutions);

// Get databases from page data
let databases = $derived(data.databases || []);

// Check if there are any pending executions
let hasPendingExecutions = $derived(
	executions.some((e) => e.status === "pending"),
);

// Auto-refresh interval for pending executions
let autoRefreshInterval: ReturnType<typeof setInterval> | null = null;

onMount(() => {
	// Check for existing guest session if not authenticated
	if (!isAuthenticated) {
		checkExistingGuest();
	}

	// Load guest task count if in guest mode
	if ($isGuestMode) {
		loadGuestTaskCount();
	}
});

async function loadGuestTaskCount() {
	try {
		guestTaskCount = await getGuestTaskCount();
	} catch (err) {
		console.error("Failed to load guest task count:", err);
	}
}

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

async function handleGuestRegistration() {
	try {
		loading = true;
		await registerGuestUser();
	} catch (err) {
		console.error("Failed to register guest:", err);
		error = "Failed to start guest session";
	} finally {
		loading = false;
	}
}

async function handleGuestSignUp() {
	showAccountDialog = true;
}

async function handleAccountCreation(migrateData: boolean) {
	if (!$guestUser) {
		// If no guest user, just redirect to sign in
		goto("/user/signin");
		return;
	}

	try {
		if (migrateData) {
			// Migrate guest tasks first
			await migrateGuestTasks($guestUser.id);
		}

		// Redirect to sign in page
		goto("/user/signin");
	} catch (err) {
		console.error("Failed to handle account creation:", err);
		throw err; // Let the dialog handle the error
	}
}

async function handleTaskSubmit(query: string, databaseId: string) {
	try {
		loading = true;
		error = "";

		// For guest users, we'll use a simple AI parsing endpoint instead of the full agent
		const endpoint = isAuthenticated
			? "/api/agent/execute"
			: "/api/ai/parse-task";
		const body = isAuthenticated
			? { query: query, databaseId: databaseId }
			: { input: query };

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		const result = await response.json();

		if (response.ok && result.success) {
			if (isAuthenticated) {
				// Authenticated user - add to execution history
				const newExecution: AgentExecutionRecord = {
					userId: "",
					executionId: result.executionId,
					status: "pending",
					query: query,
					databaseId: databaseId,
					steps: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};
				localExecutions = [newExecution, ...localExecutions];
			} else {
				// Guest user - show success message
				error = ""; // Clear any previous errors
				// You might want to show a success message here
			}
		} else {
			error = result.error || "Submission failed";
		}
	} catch (err) {
		console.error("Submission error:", err);
		error = "An error occurred while submitting. Please try again.";
	} finally {
		loading = false;
	}
}

async function refreshExecutions() {
	try {
		const response = await fetch("/api/agent/executions?limit=10");
		const result = await response.json();

		if (response.ok && result.executions) {
			localExecutions = result.executions;
		}
	} catch (err) {
		console.error("Failed to refresh executions:", err);
	}
}

function handleClearForm() {
	error = "";
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

<div class="min-h-screen bg-page-bg">
	<div class="container mx-auto px-4 py-6 sm:py-8">
		<div class="max-w-6xl mx-auto">
			<!-- Header -->
			<div class="text-center mb-8">
				<h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground-base mb-3">
					{isAuthenticated ? 'Task Manager Agent' : 'AI Task Assistant'}
				</h1>
				<p class="text-foreground-secondary text-sm sm:text-base max-w-2xl mx-auto">
					{isAuthenticated 
						? 'Describe your task in natural language. The agent will search for similar existing tasks and either update them or create a new one.'
						: 'Describe your task in natural language. Our AI will help you create structured tasks.'
					}
				</p>
			</div>

			<!-- Guest Banner for Guest Users -->
			{#if $isGuestMode && !isAuthenticated}
				<div class="mb-6">
					<GuestBanner 
						taskCount={guestTaskCount}
						daysRemaining={7}
						onSignUp={handleGuestSignUp}
					/>
				</div>
			{/if}

			<!-- Guest Registration Prompt -->
			{#if showGuestPrompt}
				<div class="mb-8 text-center">
					<div class="bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 rounded-xl p-6">
						<h2 class="text-xl font-semibold text-foreground-base mb-3">
							Try AI Task Assistant
						</h2>
						<p class="text-foreground-secondary mb-4">
							Experience AI-powered task creation without signing up. Your tasks will be saved for 7 days.
						</p>
						<div class="flex flex-col sm:flex-row gap-3 justify-center">
							<button
								onclick={handleGuestRegistration}
								class="bg-accent hover:bg-accent-button-hover text-accent-foreground font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
								disabled={loading}
							>
								{loading ? 'Starting...' : 'Try Without Signing Up'}
							</button>
							<button
								onclick={handleGuestSignUp}
								class="border border-primary text-primary hover:bg-primary/10 font-semibold py-3 px-6 rounded-xl transition-all duration-300"
							>
								Sign In with Notion
							</button>
						</div>
					</div>
				</div>
			{/if}

			{#if isAuthenticated || $isGuestMode}
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
					<!-- Task Submission Form - Left Column -->
					<div class="lg:col-span-1">
						<TaskForm 
							{databases} 
							{loading} 
							{error} 
							onSubmit={handleTaskSubmit} 
							onClear={handleClearForm}
							isGuestMode={!isAuthenticated}
						/>
					</div>

					<!-- Error Display and Execution History - Right Column -->
					<div class="lg:col-span-2">
						<ErrorAlert {error} />
						{#if isAuthenticated}
							<ExecutionHistory 
								{executions} 
								{databases} 
								{hasPendingExecutions} 
								{expandedExecutions} 
								onToggleExpanded={toggleExpanded} 
							/>
						{:else}
							<!-- Guest user - show simplified interface -->
							<div class="bg-card-bg shadow-sm rounded-xl border border-subtle-base p-6">
								<h3 class="text-lg font-semibold text-foreground-base mb-4">
									AI Task Creation
								</h3>
								<p class="text-foreground-secondary text-sm mb-4">
									As a guest user, you can create tasks using natural language. 
									Sign in with Notion to access advanced features like task history and database integration.
								</p>
								<div class="bg-info/10 border border-info/20 rounded-lg p-4">
									<p class="text-info text-sm">
										💡 <strong>Tip:</strong> Try describing tasks like "Fix login bug on mobile" or "Review API documentation"
									</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Account Creation Dialog -->
<AccountCreationDialog
	isOpen={showAccountDialog}
	guestTasks={[]} 
	onClose={() => showAccountDialog = false}
	onCreateAccount={handleAccountCreation}
/>
