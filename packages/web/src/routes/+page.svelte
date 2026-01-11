<script lang="ts">
import { signIn } from "@auth/sveltekit/client";
import type { Task, Workspace } from "@notion-task-manager/db";
import { onDestroy, onMount } from "svelte";
import { browser } from "$app/environment";
import { ErrorAlert, LoadingSpinner } from "$lib/components";
import AccountCreationDialog from "$lib/components/AccountCreationDialog.svelte";
import AgentExecutionHistory from "$lib/components/AgentExecutionHistory.svelte";
import FloatingAIInput from "$lib/components/FloatingAIInput.svelte";
import GuestBanner from "$lib/components/GuestBanner.svelte";
import SettingsDrawer from "$lib/components/SettingsDrawer.svelte";
import TaskBoard from "$lib/components/TaskBoard.svelte";
import TopMenu from "$lib/components/TopMenu.svelte";
import { guestUserService } from "$lib/services/guest-user-service";
import { taskService } from "$lib/services/task-service";
import {
	guestUser,
	isGuestMode,
	updateGuestTaskCount,
} from "$lib/stores/guest";
import type { PageData } from "$lib/types/page-data";
import {
	type ComponentEvent,
	type ComponentState,
	performanceMonitor,
	useComponentWiring,
} from "$lib/utils/component-wiring";
import { errorStateManager } from "$lib/utils/error-handling";

let { data }: { data: PageData } = $props();

// Reactive session data
let session = $derived(data.session);
let isAuthenticated = $derived(!!session);

// Component wiring setup
const { manager, subscribe, subscribeToEvents, emit, cleanup } =
	useComponentWiring();

// Component state from wiring manager
let componentState = $state<ComponentState>({
	settingsDrawerOpen: false,
	notionDialogOpen: false,
	guestUpgradePromptOpen: false,
	accountDialogOpen: false,
	currentWorkspace: null,
	integrations: [],
	tasks: [],
	loadingIntegrations: false,
	loadingDatabases: false,
	loadingTasks: false,
	errors: [],
	performanceMetrics: new Map(),
});

// Local component state
let tasks: Task[] = $state([]);
let currentWorkspace: Workspace | null = $state(null);
let loading = $state(false);
let error = $state("");
let selectedContextTasks = $state(new Set<string>());
let guestTaskCount = $state(0);
let guestDaysRemaining = $state(7);

// Derived state from component wiring
let showSettingsDrawer = $derived(componentState.settingsDrawerOpen);
let showAccountDialog = $derived(componentState.accountDialogOpen);
let integrations = $derived(componentState.integrations);

// Cleanup functions
let cleanupFunctions: Array<() => void> = [];

onMount(() => {
	// Subscribe to component wiring state changes
	const unsubscribeState = subscribe((state) => {
		componentState = state;
		// Sync local state with component state
		if (state.currentWorkspace) {
			currentWorkspace = state.currentWorkspace;
		}
		if (state.tasks.length > 0) {
			tasks = state.tasks;
		}
	});
	cleanupFunctions.push(unsubscribeState);

	// Subscribe to component events
	const unsubscribeEvents = subscribeToEvents((event: ComponentEvent) => {
		handleComponentEvent(event);
	});
	cleanupFunctions.push(unsubscribeEvents);

	// Subscribe to error state changes
	const unsubscribeErrors = errorStateManager.subscribe((errors) => {
		if (errors.length > 0) {
			const latestError = errors[0];
			error = latestError.message;
		} else {
			error = "";
		}
	});
	cleanupFunctions.push(unsubscribeErrors);

	// Async initialization with performance monitoring
	const initializeApp = async () => {
		await performanceMonitor.measure("app_initialization", async () => {
			if (isAuthenticated) {
				await loadWorkspaces();
				// Integration loading will happen after workspace is set in loadWorkspaces/createDefaultWorkspace

				// Check for pending guest data migration
				if (browser && localStorage.getItem("pending_migration") === "true") {
					await handlePendingMigration();
				}

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
						await manager.openSettingsDrawer(workspaceId);

						// Clean up URL parameters
						const url = new URL(window.location.href);
						url.searchParams.delete("oauth_success");
						url.searchParams.delete("workspace_id");
						window.history.replaceState({}, "", url.toString());
					}

					// Handle settings parameter from navigation
					if (openSettings === "true") {
						await manager.openSettingsDrawer(currentWorkspace?.id || "");
						// Clean up URL parameter
						const url = new URL(window.location.href);
						url.searchParams.delete("settings");
						window.history.replaceState({}, "", url.toString());
					}

					// Handle signup parameter from navigation
					if (openSignup === "true") {
						manager.showAccountDialog();
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
						manager.showAccountDialog();
						// Clean up URL parameter
						const url = new URL(window.location.href);
						url.searchParams.delete("signup");
						window.history.replaceState({}, "", url.toString());
					}
				}
			}
		});
	};

	// Start async initialization
	initializeApp();

	// Add global keyboard navigation support
	if (browser) {
		const handleGlobalKeyDown = (event: KeyboardEvent) => {
			// Handle escape key to close settings drawer
			if (event.key === "Escape" && showSettingsDrawer) {
				manager.closeSettingsDrawer();
				event.preventDefault();
			}
		};

		document.addEventListener("keydown", handleGlobalKeyDown);
		cleanupFunctions.push(() => {
			document.removeEventListener("keydown", handleGlobalKeyDown);
		});
	}
});

onDestroy(() => {
	// Clean up all subscriptions and event listeners
	cleanupFunctions.forEach((cleanup) => {
		cleanup();
	});
	cleanupFunctions = [];
});

async function initializeGuestSession() {
	loading = true;
	try {
		const result = await guestUserService.recoverGuestSession();

		if (result.success && result.workspace) {
			currentWorkspace = result.workspace;
			tasks = result.tasks;
			guestUserService.updateGuestStore(result.workspace, result.tasks);

			// Update component wiring state
			manager.updateState({
				currentWorkspace: result.workspace,
				tasks: result.tasks,
			});
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

function handleComponentEvent(event: ComponentEvent) {
	switch (event.type) {
		case "oauth_completed":
			if (event.success && event.workspaceId === currentWorkspace?.id) {
				// OAuth successful, database selection dialog should open
				// This is handled by the component wiring manager
			}
			break;

		case "integration_created":
			// Refresh tasks after integration is created
			if (currentWorkspace) {
				loadTasks();
			}
			break;

		case "guest_upgrade_prompted":
			// Show account dialog for guest upgrade
			manager.showAccountDialog();
			break;

		case "error_occurred":
			// Error handling is managed by error state manager
			console.error("Component error:", event.error, event.context);
			break;

		case "performance_measured":
			// Log performance metrics
			if (event.duration > 1000) {
				// Log slow operations
				console.warn(
					`Slow operation detected: ${event.metric} took ${event.duration}ms`,
				);
			}
			break;
	}
}

async function loadIntegrations() {
	if (!currentWorkspace) return;
	await manager.loadIntegrations(currentWorkspace.id);
}

async function loadWorkspaces() {
	try {
		const response = await fetch("/api/workspaces");
		const data = await response.json();

		if (response.ok) {
			const workspaces = data.workspaces || [];
			if (workspaces.length > 0) {
				currentWorkspace = workspaces[0];
				manager.updateState({ currentWorkspace: workspaces[0] });
				await loadTasks();
				await loadIntegrations();
			} else {
				// No workspaces exist, create a default one
				await createDefaultWorkspace();
			}
		} else {
			error = data.error || "Failed to load workspaces";
		}
	} catch (err) {
		error = "Failed to load workspaces";
		console.error("Error loading workspaces:", err);
	}
}

async function createDefaultWorkspace() {
	try {
		const response = await fetch("/api/workspaces", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: "My Tasks",
			}),
		});

		const data = await response.json();

		if (response.ok) {
			currentWorkspace = data.data;
			manager.updateState({ currentWorkspace: data.data });
			await loadTasks();
			await loadIntegrations();
		} else {
			error = data.error || "Failed to create default workspace";
		}
	} catch (err) {
		error = "Failed to create default workspace";
		console.error("Error creating default workspace:", err);
	}
}

async function handlePendingMigration() {
	try {
		// Get guest tasks from localStorage
		const guestBackup = localStorage.getItem("guest-backup");
		if (!guestBackup) {
			localStorage.removeItem("pending_migration");
			return;
		}

		const backupData = JSON.parse(guestBackup);
		const guestTasks = backupData.tasks || [];

		if (guestTasks.length > 0) {
			console.log(`Migrating ${guestTasks.length} guest tasks...`);
			const migrationSuccess =
				await guestUserService.migrateGuestData(guestTasks);

			if (migrationSuccess) {
				console.log("Guest data migration completed successfully");
				// Reload workspaces and tasks to show migrated data
				await loadWorkspaces();
			} else {
				console.warn("Guest data migration failed");
			}
		}

		// Clear pending migration flag
		localStorage.removeItem("pending_migration");
	} catch (error) {
		console.error("Error handling pending migration:", error);
		localStorage.removeItem("pending_migration");
	}
}

async function loadTasks() {
	if (!currentWorkspace) return;

	loading = true;
	error = "";

	try {
		tasks = await taskService.fetchTasks(currentWorkspace.id);
		manager.updateState({ tasks: tasks });
		updateTaskCount();
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
	manager.updateState({ tasks: updatedTasks });
	updateTaskCount();
	saveGuestData();
}

function saveGuestData() {
	if ($isGuestMode && !isAuthenticated && currentWorkspace) {
		guestUserService.saveGuestData({
			guestId: "guest",
			workspaceId: currentWorkspace.id,
			tasks: tasks,
			lastSync: new Date().toISOString(),
			deviceFingerprint: "", // Will be generated by the service
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
			manager.showAccountDialog();
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
	manager.showAccountDialog();
}

// Handle Notion login with guest data migration
async function handleNotionLogin(migrateData: boolean): Promise<void> {
	if (!browser) {
		throw new Error("Login can only be initiated from the browser");
	}

	try {
		// Store migration preference for after authentication
		if (migrateData && tasks.length > 0) {
			localStorage.setItem("pending_migration", "true");
		} else {
			localStorage.removeItem("pending_migration");
		}

		// Initiate Notion OAuth flow
		await signIn("notion", {
			callbackUrl: window.location.origin,
			redirect: true,
		});
	} catch (error) {
		console.error("Notion login failed:", error);
		throw error;
	}
}

async function handleOpenSettingsDrawer() {
	if (currentWorkspace) {
		await manager.openSettingsDrawer(currentWorkspace.id);
	}
}

function handleCloseSettingsDrawer() {
	manager.closeSettingsDrawer();
}

async function handleToggleIntegration(provider: string, enabled: boolean) {
	if (currentWorkspace) {
		await manager.toggleIntegration(provider, enabled, currentWorkspace.id);
	}
}

async function handleConnectNotion(
	databaseId: string,
	importExisting: boolean,
) {
	if (currentWorkspace) {
		await manager.selectDatabase(
			databaseId,
			currentWorkspace.id,
			importExisting,
		);
	}
}

async function handleDisconnectIntegration(integrationId: string) {
	if (currentWorkspace) {
		await manager.disconnectIntegration(integrationId, currentWorkspace.id);
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
	onNotionLogin={handleNotionLogin}
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