<script lang="ts">
import type { Task, Workspace } from "@notion-task-manager/db";
import { onMount } from "svelte";
import { browser } from "$app/environment";
import { ErrorAlert, LoadingSpinner } from "$lib/components";
import AccountCreationDialog from "$lib/components/AccountCreationDialog.svelte";
import AgentExecutionHistory from "$lib/components/AgentExecutionHistory.svelte";
import FloatingAIInput from "$lib/components/FloatingAIInput.svelte";
import GuestBanner from "$lib/components/GuestBanner.svelte";
import SettingsDrawer from "$lib/components/SettingsDrawer.svelte";
import TaskBoard from "$lib/components/TaskBoard.svelte";
import TopMenu from "$lib/components/TopMenu.svelte";
import { GuestRecoveryService } from "$lib/services/guestRecovery";
import {
	guestUser,
	isGuestMode,
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
let currentWorkspace: Workspace | null = $state(null);
let loading = $state(false);
let error = $state("");
let showAccountDialog = $state(false);
let showSettingsDrawer = $state(false);
let selectedContextTasks = $state(new Set<string>());
let integrations = $state([]);
let guestTaskCount = $state(0);
let guestDaysRemaining = $state(7);

onMount(() => {
	// Async initialization
	const initializeApp = async () => {
		if (isAuthenticated) {
			await loadWorkspaces();
			await loadIntegrations();

			// Check for OAuth success parameters
			if (browser) {
				const urlParams = new URLSearchParams(window.location.search);
				const oauthSuccess = urlParams.get("oauth_success");
				const workspaceId = urlParams.get("workspace_id");
				const openSettings = urlParams.get("settings");
				const openSignup = urlParams.get("signup");

				if (
					oauthSuccess === "notion" &&
					workspaceId &&
					currentWorkspace?.id === workspaceId
				) {
					// OAuth was successful, open settings drawer to show database selection
					showSettingsDrawer = true;

					// Clean up URL parameters
					const url = new URL(window.location.href);
					url.searchParams.delete("oauth_success");
					url.searchParams.delete("workspace_id");
					window.history.replaceState({}, "", url.toString());
				}

				// Handle settings parameter from navigation
				if (openSettings === "true") {
					showSettingsDrawer = true;
					// Clean up URL parameter
					const url = new URL(window.location.href);
					url.searchParams.delete("settings");
					window.history.replaceState({}, "", url.toString());
				}

				// Handle signup parameter from navigation
				if (openSignup === "true") {
					showAccountDialog = true;
					// Clean up URL parameter
					const url = new URL(window.location.href);
					url.searchParams.delete("signup");
					window.history.replaceState({}, "", url.toString());
				}
			}
		} else {
			await initializeGuestSession();

			// Check for signup parameter for guest users
			if (browser) {
				const urlParams = new URLSearchParams(window.location.search);
				const openSignup = urlParams.get("signup");

				if (openSignup === "true") {
					showAccountDialog = true;
					// Clean up URL parameter
					const url = new URL(window.location.href);
					url.searchParams.delete("signup");
					window.history.replaceState({}, "", url.toString());
				}
			}
		}
	};

	// Start async initialization
	initializeApp();

	// Add global keyboard navigation support
	if (browser) {
		const handleGlobalKeyDown = (event: KeyboardEvent) => {
			// Handle escape key to close settings drawer
			if (event.key === "Escape" && showSettingsDrawer) {
				handleCloseSettingsDrawer();
				event.preventDefault();
			}
		};

		document.addEventListener("keydown", handleGlobalKeyDown);

		// Return cleanup function
		return () => {
			document.removeEventListener("keydown", handleGlobalKeyDown);
		};
	}
});

async function initializeGuestSession() {
	loading = true;
	try {
		const recoveryService = new GuestRecoveryService();
		const result = await recoveryService.recoverGuestSession();

		if (result.success && result.workspace) {
			currentWorkspace = result.workspace;
			tasks = result.tasks;
			updateGuestStore(result.workspace);
		} else {
			error = result.message || "Failed to initialize workspace";
		}
	} catch (err) {
		console.error("Failed to setup guest session:", err);
		error = "Failed to initialize workspace";
	} finally {
		loading = false;
	}
}

function updateGuestStore(workspace: Workspace) {
	isGuestMode.set(true);
	guestUser.set({
		id: "guest",
		workspace,
		isRegistered: false,
	});
}

async function loadIntegrations() {
	if (!currentWorkspace) return;

	try {
		const response = await fetch(
			`/api/integrations?workspaceId=${currentWorkspace.id}`,
		);
		const data = await response.json();

		if (response.ok) {
			integrations = data.integrations || [];
		} else {
			console.error("Failed to load integrations:", data.error);
		}
	} catch (err) {
		console.error("Error loading integrations:", err);
	}
}
async function loadWorkspaces() {
	try {
		const response = await fetch("/api/workspaces");
		const data = await response.json();

		if (response.ok) {
			const workspaces = data.workspaces || [];
			if (workspaces.length > 0) {
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

	loading = true;
	error = "";

	try {
		const response = await fetch(
			`/api/tasks?workspaceId=${currentWorkspace.id}`,
		);
		const data = await response.json();

		if (response.ok) {
			tasks = data.data?.items || [];
			updateTaskCount();
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

function updateTaskCount() {
	if ($isGuestMode && !isAuthenticated) {
		guestTaskCount = tasks.length;
		updateGuestTaskCount(tasks.length);
	}
}

function handleTasksUpdate(updatedTasks: Task[]) {
	tasks = updatedTasks;
	updateTaskCount();
	saveGuestData();
}

function saveGuestData() {
	if ($isGuestMode && !isAuthenticated && currentWorkspace) {
		saveGuestDataLocally({
			guestId: "guest",
			workspaceId: currentWorkspace.id,
			tasks: tasks,
		});
	}
}

function handleContextToggle(taskId: string) {
	const newSelected = new Set(selectedContextTasks);
	if (newSelected.has(taskId)) {
		newSelected.delete(taskId);
	} else {
		newSelected.add(taskId);
	}
	selectedContextTasks = newSelected;
}

function handleClearContext() {
	selectedContextTasks = new Set();
}

function handleMenuAction(action: string) {
	switch (action) {
		case "signup":
			showAccountDialog = true;
			break;
		case "notion":
			handleOpenSettingsDrawer();
			break;
		case "settings":
			handleOpenSettingsDrawer();
			break;
		case "home":
			// Navigate to home or refresh current view
			if (browser) {
				window.location.href = "/";
			}
			break;
		default:
			console.log("Menu action:", action);
	}
}

function handleGuestSignUp() {
	showAccountDialog = true;
}

function handleOpenSettingsDrawer() {
	showSettingsDrawer = true;

	// Focus management for accessibility
	if (browser) {
		// Wait for the drawer to render, then focus the first focusable element
		setTimeout(() => {
			const drawer = document.querySelector(
				'[role="dialog"], .settings-drawer',
			);
			if (drawer) {
				const firstFocusable = drawer.querySelector(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
				);
				if (firstFocusable instanceof HTMLElement) {
					firstFocusable.focus();
				}
			}
		}, 100);
	}
}

function handleCloseSettingsDrawer() {
	showSettingsDrawer = false;

	// Return focus to the menu trigger for accessibility
	if (browser) {
		setTimeout(() => {
			const menuTrigger = document.querySelector('[aria-label="Open menu"]');
			if (menuTrigger instanceof HTMLElement) {
				menuTrigger.focus();
			}
		}, 100);
	}
}

async function handleToggleIntegration(provider: string, enabled: boolean) {
	// This will be handled by the SettingsDrawer component
	console.log("Toggle integration:", provider, enabled);
}

async function handleConnectNotion(
	_databaseId: string,
	_importExisting: boolean,
) {
	// Reload integrations after successful connection
	await loadIntegrations();
}

async function handleDisconnectIntegration(integrationId: string) {
	try {
		const response = await fetch(`/api/integrations/${integrationId}`, {
			method: "DELETE",
		});

		if (response.ok) {
			// Reload integrations after successful disconnection
			await loadIntegrations();
		} else {
			const data = await response.json();
			console.error("Failed to disconnect integration:", data.error);
		}
	} catch (err) {
		console.error("Error disconnecting integration:", err);
	}
}

// Get selected tasks for AI context
const contextTasks = $derived(
	tasks.filter((task) => selectedContextTasks.has(task.id)),
);
</script>

<svelte:head>
	<title>TaskFlow - AI Task Manager</title>
	<meta name="description" content="Manage your tasks with AI assistance. Create, organize, and complete tasks efficiently with optional Notion integration." />
</svelte:head>

<div class="min-h-screen bg-page-bg">
	<!-- Top Menu -->
	<TopMenu 
		onMenuAction={handleMenuAction}
		{isAuthenticated}
		isGuestMode={$isGuestMode}
	/>

	<!-- Main Content -->
	<div class="flex-1 overflow-hidden">
		{#if currentWorkspace}
			<!-- Guest Banner for non-authenticated users -->
			{#if $isGuestMode && !isAuthenticated}
				<div class="p-4 pb-0">
					<GuestBanner
						taskCount={guestTaskCount}
						daysRemaining={guestDaysRemaining}
						showIntegrationBenefits={guestTaskCount >= 5}
						onSignUp={handleGuestSignUp}
					/>
				</div>
			{/if}

			<!-- Task Board Layout -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen p-4">
				<!-- Task Board - Takes up 2/3 on large screens -->
				<div class="lg:col-span-2">
					<TaskBoard 
						workspaceId={currentWorkspace.id}
						{tasks}
						onTasksUpdate={handleTasksUpdate}
						selectedContextTasks={selectedContextTasks}
						onContextToggle={handleContextToggle}
					/>
				</div>
				
				<!-- AI Execution History - Takes up 1/3 on large screens -->
				<div class="lg:col-span-1 overflow-y-auto">
					<AgentExecutionHistory />
				</div>
			</div>

			<!-- Floating AI Input -->
			<FloatingAIInput
				workspaceId={currentWorkspace.id}
				selectedTasks={contextTasks}
				onClearContext={handleClearContext}
				onTasksUpdate={handleTasksUpdate}
			/>

			<!-- Error Display -->
			{#if error}
				<div class="fixed top-4 left-4 right-4 z-40">
					<ErrorAlert {error} />
				</div>
			{/if}

		{:else if loading}
			<!-- Loading State -->
			<LoadingSpinner text="Setting up your workspace..." />
		{/if}
	</div>
</div>

<!-- Account Creation Dialog -->
<AccountCreationDialog
	bind:open={showAccountDialog}
	guestTasks={tasks}
	onOpenChange={(open) => showAccountDialog = open}
	onNotionLogin={async () => { showAccountDialog = false; }}
/>

<!-- Settings Drawer -->
{#if currentWorkspace}
	<SettingsDrawer
		isOpen={showSettingsDrawer}
		workspaceId={currentWorkspace.id}
		{integrations}
		isAuthenticated={isAuthenticated}
		isGuestMode={$isGuestMode && !isAuthenticated}
		onClose={handleCloseSettingsDrawer}
		onToggleIntegration={handleToggleIntegration}
		onConnectNotion={handleConnectNotion}
		onDisconnectIntegration={handleDisconnectIntegration}
		onSignUp={handleGuestSignUp}
	/>
{/if}