<script lang="ts">
import type {
	AgentExecutionRecord,
	Task,
	Workspace,
} from "@notion-task-manager/db";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { ErrorAlert, ExecutionHistory, TaskForm } from "$lib/components";
import AccountCreationDialog from "$lib/components/AccountCreationDialog.svelte";
import AIAgentChatSimple from "$lib/components/AIAgentChatSimple.svelte";
import GuestBanner from "$lib/components/GuestBanner.svelte";
import {
	CheckCircle,
	List,
	Plus,
	Robot,
	Settings,
	Sparkles,
} from "$lib/components/icons";
import TaskInputSimple from "$lib/components/TaskInputSimple.svelte";
import TaskListSimple from "$lib/components/TaskListSimple.svelte";
import {
	checkExistingGuest,
	getGuestTaskCount,
	guestUser,
	isGuestMode,
	migrateGuestTasks,
	registerGuestUser,
	updateGuestTaskCount,
} from "$lib/stores/guest";
import type { PageData } from "$lib/types/page-data";
import { deleteCookie } from "$lib/utils/cookies";

let { data }: { data: PageData } = $props();

// Reactive session data
let session = $derived(data.session);
let isAuthenticated = $derived(!!session);

// Component state
let tasks: Task[] = $state([]);
let workspaces: Workspace[] = $state([]);
let currentWorkspace: Workspace | null = $state(null);
let loading = $state(false);
let error = $state("");
let showAIChat = $state(false);
let guestTaskCount = $state(0);
let showAccountDialog = $state(false);

// Agent functionality state
let expandedExecutions = $state<Set<string>>(new Set());
let localExecutions = $state<AgentExecutionRecord[]>([]);
let initialized = $state(false);
let databases = $derived(data.databases || []);
let executions = $derived(localExecutions);
let hasPendingExecutions = $derived(
	executions.some((e) => e.status === "pending"),
);
let autoRefreshInterval: ReturnType<typeof setInterval> | null = null;

// UI state
let activeTab = $state<"tasks" | "agent">("tasks");

// Initialize from server data on first render for agent executions
$effect(() => {
	if (!initialized && data.executions) {
		localExecutions = data.executions;
		initialized = true;
	}
});

// Auto-refresh interval for pending executions
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

// Debug: Track workspace changes
$effect(() => {
	console.log("currentWorkspace changed:", currentWorkspace);
});

onMount(async () => {
	if (isAuthenticated) {
		// Authenticated user - load workspaces normally
		await loadWorkspaces();
	} else {
		// Auto-register guest user with long expiration
		await handleAutoGuestRegistration();
	}
});

async function handleAutoGuestRegistration() {
	try {
		loading = true;
		console.log("Starting guest registration...");

		// Check if user is already a guest
		const hasExistingGuest = checkExistingGuest();
		console.log("Has existing guest:", hasExistingGuest);

		if (hasExistingGuest) {
			// Load existing guest workspace
			await loadGuestWorkspace();
		} else {
			// Auto-register new guest user with long expiration (e.g., 1 year)
			console.log("Registering new guest user...");
			const guest = await registerGuestUser();
			console.log("Guest registered:", guest);
			currentWorkspace = guest.workspace;
			console.log("Current workspace set:", currentWorkspace);
			await loadTasks();
		}
	} catch (err) {
		console.error("Failed to setup guest session:", err);
		error = "Failed to initialize workspace";
	} finally {
		loading = false;
	}
}

async function loadGuestWorkspace() {
	try {
		console.log("Loading guest workspace...");
		// For existing guests, we need to fetch their workspace from the backend
		// The guest-id cookie should be automatically sent with the request
		const response = await fetch("/api/workspaces");
		const data = await response.json();
		console.log("Workspaces response:", data);

		if (response.ok && data.workspaces && data.workspaces.length > 0) {
			// Use the first workspace (guest users should only have one)
			currentWorkspace = data.workspaces[0];
			console.log("Guest workspace loaded:", currentWorkspace);
			await loadTasks();
		} else if (response.status === 401) {
			// Guest user expired or doesn't exist - clear cookie and register new guest
			console.warn(
				"Guest user expired, clearing cookie and registering new guest...",
			);
			// Clear the expired guest cookie using modern API
			await deleteCookie("guest-id", { path: "/" });
			isGuestMode.set(false);
			guestUser.set(null);

			// Register a new guest user
			const guest = await registerGuestUser();
			currentWorkspace = guest.workspace;
			console.log("New guest registered with workspace:", currentWorkspace);
			await loadTasks();
		} else {
			// Other error - try to re-register the guest
			console.warn("No workspace found for existing guest, re-registering...");
			const guest = await registerGuestUser();
			currentWorkspace = guest.workspace;
			console.log("Re-registered guest workspace:", currentWorkspace);
			await loadTasks();
		}
	} catch (err) {
		console.error("Failed to load guest workspace:", err);
		// Fallback: re-register the guest
		try {
			const guest = await registerGuestUser();
			currentWorkspace = guest.workspace;
			await loadTasks();
		} catch (registerErr) {
			console.error("Failed to re-register guest:", registerErr);
			error = "Failed to load workspace";
		}
	}
}

async function handleOptionalSignUp() {
	// Show account creation dialog for optional sign up
	showAccountDialog = true;
}

async function handleAccountCreation(migrateData: boolean) {
	try {
		if (migrateData && $guestUser) {
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

async function loadWorkspaces() {
	try {
		const response = await fetch("/api/workspaces");
		const data = await response.json();

		if (response.ok) {
			workspaces = data.workspaces || [];
			// Set current workspace to first one if available
			if (workspaces.length > 0 && !currentWorkspace) {
				currentWorkspace = workspaces[0];
				await loadTasks();
			}
		} else {
			error = data.error || "Failed to load workspaces";
		}
	} catch (err) {
		error = "Failed to load workspaces";
		console.error("Error loading workspaces:", err);
	}
}

async function loadTasks() {
	if (!currentWorkspace) return;

	try {
		loading = true;
		error = "";

		const response = await fetch(
			`/api/tasks?workspaceId=${currentWorkspace.id}`,
		);
		const data = await response.json();

		if (response.ok) {
			tasks = data.data?.items || [];
			guestTaskCount = tasks.length;

			// Update guest store if in guest mode
			if ($isGuestMode && !isAuthenticated) {
				updateGuestTaskCount(tasks.length);
			}
		} else {
			error = data.error || "Failed to load tasks";
		}
	} catch (err) {
		error = "Failed to load tasks";
		console.error("Error loading tasks:", err);
	} finally {
		loading = false;
	}
}

function handleTaskCreated(newTask: Task) {
	tasks = [newTask, ...tasks];
	guestTaskCount = tasks.length;

	// Update guest store if in guest mode
	if ($isGuestMode && !isAuthenticated) {
		updateGuestTaskCount(tasks.length);
	}
}

function handleTaskUpdated(updatedTask: Task) {
	tasks = tasks.map((task) =>
		task.id === updatedTask.id ? updatedTask : task,
	);
}

function handleTaskDeleted(deletedTaskId: string) {
	tasks = tasks.filter((task) => task.id !== deletedTaskId);
	guestTaskCount = tasks.length;

	// Update guest store if in guest mode
	if ($isGuestMode && !isAuthenticated) {
		updateGuestTaskCount(tasks.length);
	}
}

function handleError(event: CustomEvent) {
	error = event.detail;
}

// Wrapper function for TaskListSimple (Svelte 5 style)
function handleErrorFromTaskList(errorMessage: string) {
	error = errorMessage;
}

function toggleAIChat() {
	showAIChat = !showAIChat;
}

function goToNotionIntegration() {
	goto("/notion");
}

function switchTab(tab: "tasks" | "agent") {
	activeTab = tab;
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

async function handleAgentTaskSubmit(query: string, databaseId: string) {
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
				// Guest user - show success message and refresh tasks
				error = ""; // Clear any previous errors
				await loadTasks(); // Refresh the task list
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
	<title>TaskFlow - AI Task Manager</title>
	<meta name="description" content="Manage your tasks with AI assistance. Create, organize, and complete tasks efficiently with optional Notion integration." />
</svelte:head>

<div class="min-h-screen bg-page-bg">
	<!-- Header -->
	<header class="text-center py-8 px-4">
		<h1 class="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground-base mb-3">
			<Sparkles class="inline w-8 h-8 md:w-10 md:h-10 mr-3 text-accent" />
			TaskFlow
		</h1>
		<p class="text-foreground-secondary text-sm md:text-base">
			Manage your tasks with AI assistance
		</p>
	</header>

	<!-- Guest Banner for Guest Users -->
	{#if $isGuestMode && !isAuthenticated}
		<div class="mb-6 px-4">
			<div class="max-w-4xl mx-auto">
				<div class="bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 rounded-xl p-4">
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<h2 class="text-lg font-semibold text-accent-button-hover mb-2">You're using guest mode</h2>
							<p class="text-accent text-sm">Your tasks are saved locally. Sign up to sync across devices and integrate with Notion.</p>
						</div>
						<div class="flex gap-2">
							<button
								onclick={handleOptionalSignUp}
								class="bg-accent hover:bg-accent-button-hover text-accent-foreground font-medium py-2 px-4 rounded-lg transition-colors text-sm"
							>
								Sign Up (Optional)
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Notion Integration Banner for Authenticated Users -->
	{#if isAuthenticated}
		<div class="mb-6 px-4">
			<div class="max-w-4xl mx-auto">
				<div class="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-4">
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<h2 class="text-lg font-semibold text-primary-button-hover mb-2">Notion Integration Available</h2>
							<p class="text-primary text-sm">Connect your Notion databases to sync and manage tasks across platforms.</p>
						</div>
						<button
							onclick={goToNotionIntegration}
							class="bg-primary hover:bg-primary-button-hover text-primary-foreground font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2"
						>
							<Settings class="w-4 h-4" />
							Manage Integration
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<div class="max-w-4xl mx-auto px-4">
		{#if currentWorkspace}
			<!-- Tab Navigation -->
			<div class="mb-6">
				<div class="bg-card-bg border border-subtle-base rounded-xl p-1 inline-flex">
					<button
						onclick={() => switchTab('tasks')}
						class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {activeTab === 'tasks' 
							? 'bg-primary text-primary-foreground shadow-sm' 
							: 'text-foreground-secondary hover:text-foreground-base hover:bg-surface-raised'}"
					>
						<List class="w-4 h-4 inline mr-2" />
						My Tasks
					</button>
					<button
						onclick={() => switchTab('agent')}
						class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {activeTab === 'agent' 
							? 'bg-accent text-accent-foreground shadow-sm' 
							: 'text-foreground-secondary hover:text-foreground-base hover:bg-surface-raised'}"
					>
						<Robot class="w-4 h-4 inline mr-2" />
						AI Agent
					</button>
				</div>
			</div>

			<!-- Main Grid Layout -->
			<div class="grid md:grid-cols-3 gap-6">
				<!-- Task/Agent Input Section -->
				<div class="md:col-span-2">
					{#if activeTab === 'tasks'}
						<!-- Simple Task Input -->
						<div class="bg-card-bg border border-subtle-base rounded-xl p-6 mb-6">
							<h2 class="text-xl font-semibold text-foreground-base mb-4 flex items-center gap-2">
								<Plus class="w-5 h-5 text-primary" />
								New Task
							</h2>
							{#key currentWorkspace.id}
								<TaskInputSimple 
									workspaceId={currentWorkspace.id}
									ontaskcreated={handleTaskCreated}
									onerror={handleErrorFromTaskList}
								/>
							{/key}
						</div>

						<!-- Task List -->
						<div class="bg-card-bg border border-subtle-base rounded-xl p-6">
							<div class="flex justify-between items-center mb-4">
								<h2 class="text-xl font-semibold text-foreground-base flex items-center gap-2">
									<CheckCircle class="w-5 h-5 text-accent" />
									My Tasks
								</h2>
								<span class="bg-surface-raised px-3 py-1 rounded-full text-foreground-secondary text-sm">
									{tasks.filter(t => t.status !== 'done' && !t.archived).length} active, {tasks.filter(t => t.status === 'done').length} done
								</span>
							</div>
							
							<TaskListSimple 
								{tasks}
								{loading}
								ontaskupdated={handleTaskUpdated}
								ontaskdeleted={handleTaskDeleted}
								onerror={handleErrorFromTaskList}
							/>
						</div>
					{:else}
						<!-- Agent Task Form -->
						<TaskForm 
							{databases} 
							{loading} 
							{error} 
							onSubmit={handleAgentTaskSubmit} 
							onClear={handleClearForm}
							isGuestMode={!isAuthenticated}
						/>

						<!-- Agent Execution History -->
						{#if isAuthenticated}
							<div class="mt-6">
								<ExecutionHistory 
									{executions} 
									{databases} 
									{hasPendingExecutions} 
									{expandedExecutions} 
									onToggleExpanded={toggleExpanded} 
								/>
							</div>
						{:else}
							<!-- Guest user - show simplified interface -->
							<div class="mt-6 bg-card-bg shadow-sm rounded-xl border border-subtle-base p-6">
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
					{/if}
				</div>

				<!-- AI Assistant Sidebar -->
				<div class="md:col-span-1">
					<div class="bg-card-bg border border-subtle-base rounded-xl p-6 h-full flex flex-col">
						<h2 class="text-xl font-semibold text-foreground-base mb-4 flex items-center gap-2">
							<Robot class="w-5 h-5 text-accent" />
							AI Assistant
						</h2>
						
						<div class="flex-1">
							<AIAgentChatSimple workspaceId={currentWorkspace?.id} />
						</div>

						<!-- Quick Actions -->
						<div class="mt-4 pt-4 border-t border-subtle-base">
							<div class="flex flex-wrap gap-2">
								<button
									onclick={() => switchTab('tasks')}
									class="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-full transition-colors {activeTab === 'tasks' ? 'bg-primary/20' : ''}"
								>
									📋 Tasks
								</button>
								<button
									onclick={() => switchTab('agent')}
									class="text-xs bg-accent/10 hover:bg-accent/20 text-accent px-3 py-2 rounded-full transition-colors {activeTab === 'agent' ? 'bg-accent/20' : ''}"
								>
									🤖 Agent
								</button>
								<button
									onclick={loadTasks}
									class="text-xs bg-surface-raised hover:bg-surface-base text-foreground-secondary px-3 py-2 rounded-full transition-colors"
								>
									🔄 Refresh
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Error Display -->
			{#if error}
				<div class="mt-6">
					<ErrorAlert {error} />
				</div>
			{/if}

		{:else if loading}
			<!-- Loading State -->
			<div class="flex items-center justify-center py-12">
				<svg class="animate-spin h-8 w-8 text-primary mr-3" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<span class="text-foreground-secondary">Setting up your workspace...</span>
			</div>
		{/if}
	</div>
</div>

<!-- Account Creation Dialog -->
<AccountCreationDialog
	isOpen={showAccountDialog}
	guestTasks={tasks}
	onClose={() => showAccountDialog = false}
	onCreateAccount={handleAccountCreation}
/>