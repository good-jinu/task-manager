<script lang="ts">
import type { Task, Workspace } from "@notion-task-manager/db";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { ErrorAlert } from "$lib/components";
import AccountCreationDialog from "$lib/components/AccountCreationDialog.svelte";
import ChatInterface from "$lib/components/ChatInterface.svelte";
import { Settings } from "$lib/components/icons";
import RecoveryNotification from "$lib/components/RecoveryNotification.svelte";
import TaskDisplay from "$lib/components/TaskDisplay.svelte";
import { GuestRecoveryService } from "$lib/services/guestRecovery";
import {
	guestUser,
	isGuestMode,
	migrateGuestTasks,
	updateGuestTaskCount,
} from "$lib/stores/guest";
import { saveGuestDataLocally } from "$lib/stores/guestPersistence";
import type { PageData } from "$lib/types/page-data";

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
let showAccountDialog = $state(false);

// Recovery notification state
let showRecoveryNotification = $state(false);
let recoveryNotification = $state<{
	type: "success" | "info" | "warning";
	title: string;
	message: string;
	taskCount?: number;
}>({
	type: "info",
	title: "",
	message: "",
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
		console.log("Starting guest registration with recovery...");

		const recoveryService = new GuestRecoveryService();
		const recoveryResult = await recoveryService.recoverGuestSession();

		if (recoveryResult.success && recoveryResult.workspace) {
			currentWorkspace = recoveryResult.workspace;
			tasks = recoveryResult.tasks;

			// Update guest store
			isGuestMode.set(true);
			guestUser.set({
				id: "guest", // We'll get the actual ID from the cookie
				workspace: currentWorkspace,
				isRegistered: false,
			});

			// Show recovery notification if data was recovered
			if (
				recoveryResult.recoveredFromLocal &&
				recoveryResult.tasks.length > 0
			) {
				recoveryNotification = {
					type: "success",
					title: "Tasks Recovered!",
					message: "We found your previous tasks and restored them.",
					taskCount: recoveryResult.tasks.length,
				};
				showRecoveryNotification = true;

				// Auto-hide after 8 seconds
				setTimeout(() => {
					showRecoveryNotification = false;
				}, 8000);
			} else if (recoveryResult.recoveredFromLocal) {
				recoveryNotification = {
					type: "info",
					title: "Session Restored",
					message: "Your workspace has been restored.",
				};
				showRecoveryNotification = true;

				setTimeout(() => {
					showRecoveryNotification = false;
				}, 5000);
			}

			console.log("Guest session recovered successfully:", currentWorkspace);
		} else {
			error = recoveryResult.message || "Failed to initialize workspace";
		}
	} catch (err) {
		console.error("Failed to setup guest session:", err);
		error = "Failed to initialize workspace";
	} finally {
		loading = false;
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

		// Since we removed user pages, we'll handle account creation differently
		// For now, we'll just close the dialog and show a success message
		showAccountDialog = false;

		// You can implement your account creation logic here
		// For example, redirect to an external auth provider or handle it via API
		console.log("Account creation requested with migrate data:", migrateData);
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

function handleTasksUpdate(updatedTasks: Task[]) {
	// Update tasks from chat interface
	tasks = [...tasks, ...updatedTasks];

	// Update guest store if in guest mode
	if ($isGuestMode && !isAuthenticated) {
		updateGuestTaskCount(tasks.length);
		// Save to local storage for persistence
		if (currentWorkspace) {
			saveGuestDataLocally({
				guestId: "guest",
				workspaceId: currentWorkspace.id,
				tasks: tasks,
			});
		}
	}
}

function goToNotionIntegration() {
	goto("/notion");
}
</script>

<svelte:head>
	<title>TaskFlow - AI Task Manager</title>
	<meta name="description" content="Manage your tasks with AI assistance. Create, organize, and complete tasks efficiently with optional Notion integration." />
</svelte:head>

<div class="min-h-screen bg-page-bg">
	<!-- Guest Banner for Guest Users -->
	{#if $isGuestMode && !isAuthenticated}
		<div class="p-4">
			<div class="max-w-6xl mx-auto">
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
		<div class="p-4">
			<div class="max-w-6xl mx-auto">
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
	<div class="max-w-6xl mx-auto px-4 {$isGuestMode && !isAuthenticated || isAuthenticated ? 'h-[calc(100vh-120px)]' : 'h-screen'}">
		{#if currentWorkspace}
			<!-- Main Chat Layout -->
			<div class="grid md:grid-cols-4 gap-6 h-full">
				<!-- Chat Interface -->
				<div class="md:col-span-3 bg-card border rounded-xl overflow-hidden">
					<ChatInterface 
						workspaceId={currentWorkspace.id}
						onTasksUpdate={handleTasksUpdate}
					/>
				</div>

				<!-- Task Sidebar -->
				<div class="md:col-span-1 space-y-4 overflow-y-auto">
					<TaskDisplay 
						{tasks}
						title="Current Tasks"
					/>
				</div>
			</div>

			<!-- Error Display -->
			{#if error}
				<div class="mt-4">
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
	bind:open={showAccountDialog}
	guestTasks={tasks}
	onOpenChange={(open) => showAccountDialog = open}
	onCreateAccount={handleAccountCreation}
/>

<!-- Recovery Notification -->
<RecoveryNotification
	show={showRecoveryNotification}
	type={recoveryNotification.type}
	title={recoveryNotification.title}
	message={recoveryNotification.message}
	taskCount={recoveryNotification.taskCount}
	onClose={() => showRecoveryNotification = false}
/>