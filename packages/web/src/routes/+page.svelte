<script lang="ts">
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
import WorkspaceCreateDialog from "$lib/components/WorkspaceCreateDialog.svelte";
import {
	handleCreateWorkspace,
	handleWorkspaceChange,
	initializeApp,
} from "$lib/services/app-initialization";
import {
	handleClearContext,
	handleCloseSettingsDrawer,
	handleComponentEvent,
	handleConnectNotion,
	handleContextToggle,
	handleDisconnectIntegration,
	handleGlobalKeyDown,
	handleGuestSignUp,
	handleMenuAction,
	handleNotionLogin,
	handleTasksUpdate,
	handleToggleIntegration,
} from "$lib/services/event-handlers";
import { appState, contextTasks } from "$lib/stores/app-state";
import { isGuestMode } from "$lib/stores/guest";
import type { PageData } from "$lib/types/page-data";
import { urlParamHandler } from "$lib/utils/url-params";
import "$lib/types/auth"; // Import auth type extensions
import {
	type ComponentEvent,
	type ComponentState,
	useComponentWiring,
} from "$lib/utils/component-wiring";
import { errorStateManager } from "$lib/utils/error-handling";

let { data }: { data: PageData } = $props();

// Reactive session data
let session = $derived(data.session);
let isAuthenticated = $derived(!!session);

// Component wiring setup
const { manager, subscribe, subscribeToEvents } = useComponentWiring();

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

// Derived state from stores and component wiring
let showSettingsDrawer = $derived(componentState.settingsDrawerOpen);
let showAccountDialog = $derived(componentState.accountDialogOpen);

// App state from store
let {
	tasks,
	currentWorkspace,
	workspaces,
	loading,
	error,
	selectedContextTasks,
	guestTaskCount,
	guestDaysRemaining,
	showWorkspaceCreateDialog,
} = $derived($appState);

// Cleanup functions
let cleanupFunctions: Array<() => void> = [];

onMount(() => {
	// Subscribe to component wiring state changes
	const unsubscribeState = subscribe((state) => {
		componentState = state;
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
			appState.setError(latestError.message);
		} else {
			appState.setError("");
		}
	});
	cleanupFunctions.push(unsubscribeErrors);

	// Initialize the application
	initializeApp(session);

	// Handle URL parameters after initialization
	handleURLParametersAfterInit();

	// Add global keyboard navigation support
	if (browser) {
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

/**
 * Handle URL parameters that need current workspace context
 */
function handleURLParametersAfterInit() {
	if (!browser) return;

	const params = urlParamHandler.parseParams();

	// Handle OAuth success
	urlParamHandler.handleOAuthSuccess(params, currentWorkspace?.id, async () => {
		if (currentWorkspace) {
			await manager.openSettingsDrawer(currentWorkspace.id);
		}
	});

	// Handle settings parameter
	urlParamHandler.handleSettingsParam(params, async () => {
		if (currentWorkspace) {
			await manager.openSettingsDrawer(currentWorkspace.id);
		}
	});
}
</script>

<svelte:head>
	<title>TaskFlow - AI Task Manager</title>
	<meta name="description" content="Manage your tasks with AI assistance. Create, organize, and complete tasks efficiently with optional Notion integration." />
</svelte:head>

<div class="min-h-screen bg-page-bg">
	<!-- Top Menu -->
	<TopMenu 
		onMenuAction={handleMenuAction}
		onWorkspaceChange={handleWorkspaceChange}
		onCreateWorkspace={() => appState.setShowWorkspaceCreateDialog(true)}
		{isAuthenticated}
		isGuestMode={$isGuestMode}
		{workspaces}
		{currentWorkspace}
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
				selectedTasks={$contextTasks}
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
		isAuthenticated={isAuthenticated}
		isGuestMode={$isGuestMode && !isAuthenticated}
		onClose={handleCloseSettingsDrawer}
		onToggleIntegration={handleToggleIntegration}
		onConnectNotion={handleConnectNotion}
		onDisconnectIntegration={handleDisconnectIntegration}
		onSignUp={handleGuestSignUp}
	/>
{/if}

<!-- Workspace Creation Dialog -->
<WorkspaceCreateDialog
	bind:open={showWorkspaceCreateDialog}
	onCreateWorkspace={handleCreateWorkspace}
/>