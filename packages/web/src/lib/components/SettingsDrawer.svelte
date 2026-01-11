<script lang="ts">
import type { ExternalIntegration, SyncStatus } from "@notion-task-manager/db";
import {
	createWorkspaceStatusStore,
	refreshIntegrationStatus,
} from "$lib/stores/integration-status";
import {
	databaseCache,
	preloadDatabasesForWorkspace,
} from "$lib/utils/database-cache";
import type {
	IntegrationStatus as CacheIntegrationStatus,
	SyncStatistics as CacheSyncStatistics,
} from "$lib/utils/integration-status";
import {
	lazyLoader,
	lazyOnHover,
	preloadIntegrationResources,
} from "$lib/utils/lazy-loading";
import IntegrationStatusBadge from "./IntegrationStatusBadge.svelte";
import IntegrationToggle from "./IntegrationToggle.svelte";
import {
	CheckCircle,
	Close,
	Database,
	KeyboardArrowRight,
	RefreshRounded,
} from "./icons";
import NotionIntegrationDialog from "./NotionIntegrationDialog.svelte";
import { Button } from "./ui";
import { cn } from "./utils";

interface NotionDatabase {
	id: string;
	name: string;
	url?: string;
}

// Component-specific interfaces (different from cache types)
interface IntegrationStatus {
	status:
		| "disconnected"
		| "disabled"
		| "synced"
		| "pending"
		| "conflict"
		| "error";
	lastSyncAt?: Date;
	lastError?: string;
	syncCount?: number;
	conflictCount?: number;
}

interface SyncStatistics {
	totalTasks: number;
	syncedTasks: number;
	pendingTasks: number;
	errorTasks: number;
	lastSyncDuration?: number;
}

// Adapter functions to convert between cache types and component types
function adaptIntegrationStatus(
	cacheStatus: CacheIntegrationStatus,
): IntegrationStatus {
	// Map cache status values to component status values
	let status: IntegrationStatus["status"];
	switch (cacheStatus.status) {
		case "connected":
			status = "synced";
			break;
		case "syncing":
			status = "pending";
			break;
		default:
			status = cacheStatus.status; // "disconnected", "error"
	}

	return {
		status,
		lastSyncAt: cacheStatus.lastSync
			? new Date(cacheStatus.lastSync)
			: undefined,
		lastError: cacheStatus.error,
	};
}

function adaptIntegrationStatusForToggle(cacheStatus: CacheIntegrationStatus): {
	status: "disconnected" | "disabled" | "synced" | "pending" | "error";
	lastSyncAt?: Date;
	lastError?: string;
	syncCount?: number;
	conflictCount?: number;
} {
	// Map cache status values to toggle component status values (no "conflict")
	let status: "disconnected" | "disabled" | "synced" | "pending" | "error";
	switch (cacheStatus.status) {
		case "connected":
			status = "synced";
			break;
		case "syncing":
			status = "pending";
			break;
		default:
			status = cacheStatus.status; // "disconnected", "error"
	}

	return {
		status,
		lastSyncAt: cacheStatus.lastSync
			? new Date(cacheStatus.lastSync)
			: undefined,
		lastError: cacheStatus.error,
	};
}

function adaptSyncStatistics(cacheStats: CacheSyncStatistics): SyncStatistics {
	return {
		totalTasks: cacheStats.totalTasks,
		syncedTasks: cacheStats.syncedTasks,
		pendingTasks: 0, // Not available in cache stats
		errorTasks: cacheStats.failedTasks,
		lastSyncDuration: cacheStats.syncDuration,
	};
}

interface Props {
	isOpen: boolean;
	workspaceId: string;
	integrations?: ExternalIntegration[];
	isAuthenticated?: boolean;
	isGuestMode?: boolean;
	onClose: () => void;
	onToggleIntegration: (provider: string, enabled: boolean) => Promise<void>;
	onConnectNotion: (
		databaseId: string,
		importExisting: boolean,
	) => Promise<void>;
	onDisconnectIntegration: (integrationId: string) => Promise<void>;
	onSignUp?: () => void;
	class?: string;
}

let {
	isOpen,
	workspaceId,
	integrations = [],
	isAuthenticated = true,
	isGuestMode = false,
	onClose,
	onToggleIntegration,
	onConnectNotion,
	onDisconnectIntegration,
	onSignUp,
	class: className = "",
}: Props = $props();

let showNotionDialog = $state(false);
let availableDatabases = $state<NotionDatabase[]>([]);
let loadingDatabases = $state(false);
let databaseLoadError = $state<string | null>(null);
let showGuestUpgradePrompt = $state(false);

// Create status store reactively
let statusStore = $state<ReturnType<typeof createWorkspaceStatusStore> | null>(
	null,
);

// Initialize status store when component mounts
$effect(() => {
	if (workspaceId) {
		statusStore = createWorkspaceStatusStore(workspaceId, false);
	}
});

// Reactive access to status store properties
const statusIntegrations = $derived(
	statusStore ? statusStore.integrations : null,
);
const statusLoading = $derived(statusStore ? statusStore.loading : null);
const statusError = $derived(statusStore ? statusStore.error : null);

// Find Notion integration from status data
const notionIntegration = $derived(
	statusIntegrations && $statusIntegrations
		? $statusIntegrations.find((item) => item.integration.provider === "notion")
		: null,
);

// Get current integration status and stats with type adaptation
const currentIntegrationStatus = $derived(
	notionIntegration?.status
		? adaptIntegrationStatus(notionIntegration.status)
		: null,
);
const currentIntegrationStatusForToggle = $derived(
	notionIntegration?.status
		? adaptIntegrationStatusForToggle(notionIntegration.status)
		: null,
);
const syncStats = $derived(
	notionIntegration?.stats
		? adaptSyncStatistics(notionIntegration.stats)
		: null,
);

// Enhanced drawer management with preloading
$effect(() => {
	if (typeof document === "undefined") return;

	if (isOpen) {
		document.body.style.overflow = "hidden";

		// Start polling for status updates when drawer opens
		if (statusStore) {
			statusStore.startPolling();
		}

		// Preload integration resources
		preloadIntegrationResources(workspaceId);

		// Preload databases for faster dialog opening
		if (isAuthenticated && !isGuestMode) {
			preloadDatabasesForWorkspace(workspaceId);
		}

		// Preload components that might be needed
		lazyLoader.preloadForTrigger("settingsOpen");

		// Handle escape key to close drawer
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", handleKeyDown);
			// Stop polling when drawer closes
			if (statusStore) {
				statusStore.stopPolling();
			}
		};
	} else {
		document.body.style.overflow = "";
		if (statusStore) {
			statusStore.stopPolling();
		}
	}
});

async function handleRefreshStatus() {
	if (notionIntegration && statusStore) {
		await refreshIntegrationStatus(notionIntegration.integration.id);
		// Also refresh the workspace status
		await statusStore.refresh();
	}
}

async function handleNotionToggle(enabled: boolean) {
	// Check if user is in guest mode and trying to enable integration
	if (enabled && isGuestMode) {
		showGuestUpgradePrompt = true;
		return;
	}

	if (enabled && !notionIntegration) {
		// Need to connect - initiate OAuth flow
		try {
			const response = await fetch("/api/integrations/notion/oauth", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					workspaceId,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to initiate OAuth");
			}

			const data = await response.json();

			// Redirect to Notion OAuth
			window.location.href = data.authUrl;
		} catch (error) {
			console.error("Failed to initiate OAuth:", error);
			// Could show error message to user here
		}
	} else if (notionIntegration) {
		// Toggle existing integration
		await onToggleIntegration("notion", enabled);
		// Refresh status after toggle
		if (statusStore) {
			setTimeout(() => statusStore?.refresh(), 500);
		}
	}
}

async function loadNotionDatabases() {
	loadingDatabases = true;
	databaseLoadError = null;

	try {
		// Use cached databases with enhanced loading
		const databases = await databaseCache.getDatabases(workspaceId);
		availableDatabases = databases;
	} catch (error) {
		console.error("Failed to load databases:", error);
		availableDatabases = [];
		databaseLoadError =
			error instanceof Error ? error.message : "Failed to load databases";
	} finally {
		loadingDatabases = false;
	}
}

async function handleConfigureNotion() {
	// Check if user is in guest mode
	if (isGuestMode) {
		showGuestUpgradePrompt = true;
		return;
	}

	// Preload dialog component
	lazyLoader.preloadForTrigger("integrationToggle");

	// Check if databases are already cached
	if (databaseCache.hasCachedDatabases(workspaceId)) {
		availableDatabases = (await databaseCache.getDatabases(workspaceId)) || [];
		showNotionDialog = true;
	} else {
		// Load databases and show dialog
		loadNotionDatabases();
		showNotionDialog = true;
	}
}

function handleRetryDatabaseLoad() {
	databaseLoadError = null;
	loadNotionDatabases();
}

async function handleDisconnectNotion() {
	if (notionIntegration) {
		await onDisconnectIntegration(notionIntegration.integration.id);
		// Refresh status after disconnect
		if (statusStore) {
			setTimeout(() => statusStore?.refresh(), 500);
		}
	}
}

function handleCloseNotionDialog() {
	showNotionDialog = false;
	databaseLoadError = null;
}

function handleCloseGuestUpgradePrompt() {
	showGuestUpgradePrompt = false;
}

function handleGuestSignUp() {
	showGuestUpgradePrompt = false;
	onSignUp?.();
}

async function handleConnectNotionDatabase(
	databaseId: string,
	importExisting: boolean,
) {
	try {
		// Create the integration record
		const response = await fetch("/api/integrations", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				workspaceId,
				provider: "notion",
				externalId: databaseId,
				config: {
					databaseId,
					databaseName:
						availableDatabases.find((db) => db.id === databaseId)?.name ||
						"Unknown Database",
					importExisting,
				},
				syncEnabled: true,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to create integration");
		}

		const data = await response.json();

		// Call the parent handler to update the integrations list
		await onConnectNotion(databaseId, importExisting);

		showNotionDialog = false;
		databaseLoadError = null;
	} catch (error) {
		console.error("Failed to connect database:", error);
		// The error will be handled by the dialog component
		throw error;
	}
}
</script>

<!-- Backdrop -->
{#if isOpen}
	<div 
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
		role="button"
		tabindex="0"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		aria-label="Close settings drawer"
	></div>
{/if}

<!-- Drawer -->
<div class={cn(
	// Base positioning and sizing with responsive breakpoints
	'fixed top-0 right-0 h-full bg-surface-base shadow-xl z-50',
	'transform transition-transform duration-200 ease-out',
	'overflow-y-auto overscroll-contain',
	// Mobile-first responsive width
	'w-full max-w-[400px]',
	// Tablet breakpoint
	'sm:max-w-[480px]',
	// Desktop breakpoint  
	'lg:max-w-[520px]',
	// Animation state
	isOpen ? 'translate-x-0' : 'translate-x-full',
	className
)}>
	<!-- Header -->
	<div class="sticky top-0 bg-surface-base/95 backdrop-blur-sm border-b border-subtle-base px-4 py-4 sm:px-6">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-foreground-base">Settings</h2>
			<button
				onclick={onClose}
				class={cn(
					'p-2 rounded-lg text-muted-foreground hover:text-foreground-base',
					'hover:bg-surface-muted active:bg-surface-muted/80 transition-colors',
					// Ensure 44px minimum touch target
					'min-w-[44px] min-h-[44px] flex items-center justify-center',
					// Enhanced mobile touch feedback
					'touch-manipulation select-none'
				)}
				aria-label="Close settings"
			>
				<Close class="w-5 h-5" />
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="p-4 sm:p-6 space-y-6 sm:space-y-8 pb-safe-area-inset-bottom">
		<!-- Integrations Section -->
		<section>
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-base font-medium text-foreground-base">Integrations</h3>
				{#if notionIntegration}
					<button
						onclick={handleRefreshStatus}
						disabled={statusLoading ? $statusLoading : false}
						class={cn(
							'p-2 rounded-lg text-muted-foreground hover:text-foreground-base',
							'hover:bg-surface-muted active:bg-surface-muted/80 transition-colors',
							'min-w-[44px] min-h-[44px] flex items-center justify-center',
							'touch-manipulation select-none',
							(statusLoading && $statusLoading) && 'animate-spin'
						)}
						aria-label="Refresh integration status"
					>
						<RefreshRounded class="w-4 h-4" />
					</button>
				{/if}
			</div>

			<!-- Guest User Restriction Notice -->
			{#if isGuestMode}
				<div class="mb-4 p-4 bg-info-alert-bg border border-info-border rounded-lg">
					<div class="flex items-start gap-3">
						<div class="flex-shrink-0 mt-0.5">
							<Database class="w-5 h-5 text-info" />
						</div>
						<div class="flex-1">
							<h4 class="text-sm font-medium text-foreground-emphasis mb-1">
								Integrations require an account
							</h4>
							<p class="text-sm text-foreground-secondary mb-3">
								Connect with Notion, Google Calendar, and other services to sync your tasks across platforms.
							</p>
							<Button
								onclick={handleGuestSignUp}
								variant="primary"
								size="sm"
								class="bg-primary hover:bg-primary-button-hover text-primary-foreground min-h-[44px]"
							>
								Create Free Account
							</Button>
						</div>
					</div>
				</div>
			{/if}

			<div class="space-y-4">
				<!-- Notion Integration -->
				<div class="space-y-3">
					<IntegrationToggle
						integration={notionIntegration?.integration}
						workspaceId={workspaceId}
						disabled={isGuestMode}
						onToggle={handleNotionToggle}
						onConfigure={notionIntegration ? handleConfigureNotion : undefined}
						integrationStatus={currentIntegrationStatusForToggle || undefined}
					/>

					{#if notionIntegration}
						<!-- Integration Status and Statistics -->
						<div class="ml-2 sm:ml-9 space-y-3">
							<!-- Status Badge and Details -->
							<div class="flex items-center gap-3">
								<IntegrationStatusBadge 
									integration={notionIntegration.integration}
									integrationStatus={currentIntegrationStatus || undefined}
									syncStats={syncStats || undefined}
									size="md"
									showDetails={false}
									loading={statusLoading ? ($statusLoading || false) : false}
									class="flex-shrink-0"
								/>
								{#if currentIntegrationStatus?.lastSyncAt}
									<span class="text-xs text-muted-foreground">
										Last synced: {currentIntegrationStatus.lastSyncAt.toLocaleString()}
									</span>
								{/if}
							</div>

							<!-- Sync Statistics -->
							{#if syncStats}
								<div class="bg-surface-muted rounded-lg p-3 space-y-2">
									<h4 class="text-sm font-medium text-foreground-base">Sync Statistics</h4>
									<div class="grid grid-cols-2 gap-3 text-xs">
										<div>
											<span class="text-muted-foreground">Total Tasks:</span>
											<span class="ml-1 font-medium">{syncStats.totalTasks}</span>
										</div>
										<div>
											<span class="text-muted-foreground">Synced:</span>
											<span class="ml-1 font-medium text-success">{syncStats.syncedTasks}</span>
										</div>
										<div>
											<span class="text-muted-foreground">Errors:</span>
											<span class="ml-1 font-medium text-error">{syncStats.errorTasks}</span>
										</div>
									</div>
									{#if syncStats.lastSyncDuration}
										<div class="text-xs text-muted-foreground">
											Last sync took {syncStats.lastSyncDuration}ms
										</div>
									{/if}
								</div>
							{/if}

							<!-- Action Buttons -->
							<div class="space-y-2">
								<button
									onclick={handleConfigureNotion}
									use:lazyOnHover={'NotionIntegrationDialog'}
									class={cn(
										'flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700',
										'active:text-blue-800 transition-colors',
										// Ensure 44px minimum touch target
										'min-h-[44px] px-3 py-2 rounded-lg',
										'hover:bg-blue-50 active:bg-blue-100',
										'touch-manipulation select-none w-full justify-start'
									)}
								>
									<Database class="w-4 h-4 flex-shrink-0" />
									<span>Change Database</span>
									<KeyboardArrowRight class="w-4 h-4 flex-shrink-0 ml-auto" />
								</button>
								
								<button
									onclick={handleDisconnectNotion}
									class={cn(
										'flex items-center gap-2 text-sm text-red-600 hover:text-red-700',
										'active:text-red-800 transition-colors',
										// Ensure 44px minimum touch target
										'min-h-[44px] px-3 py-2 rounded-lg',
										'hover:bg-red-50 active:bg-red-100',
										'touch-manipulation select-none w-full justify-start'
									)}
								>
									<span>Disconnect Notion</span>
								</button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Future integrations placeholder -->
				<div class="opacity-50 pointer-events-none">
					<div class="flex items-center justify-between p-4 bg-surface-muted border border-subtle-base rounded-lg">
						<div class="flex items-center gap-3 min-w-0">
							<div class="w-6 h-6 bg-subtle-base rounded flex-shrink-0"></div>
							<div class="min-w-0">
								<h4 class="font-medium text-muted-foreground truncate">Google Calendar</h4>
								<p class="text-sm text-muted-foreground">Coming soon</p>
							</div>
						</div>
						<div class="w-11 h-6 bg-subtle-base rounded-full flex-shrink-0"></div>
					</div>
				</div>

				<div class="opacity-50 pointer-events-none">
					<div class="flex items-center justify-between p-4 bg-surface-muted border border-subtle-base rounded-lg">
						<div class="flex items-center gap-3 min-w-0">
							<div class="w-6 h-6 bg-subtle-base rounded flex-shrink-0"></div>
							<div class="min-w-0">
								<h4 class="font-medium text-muted-foreground truncate">Slack</h4>
								<p class="text-sm text-muted-foreground">Coming soon</p>
							</div>
						</div>
						<div class="w-11 h-6 bg-subtle-base rounded-full flex-shrink-0"></div>
					</div>
				</div>
			</div>
		</section>

		<!-- Workspace Section -->
		<section>
			<h3 class="text-base font-medium text-foreground-base mb-4">Workspace</h3>
			<div class="space-y-3">
				<div class="text-sm text-foreground-secondary">
					<span class="font-medium">Workspace ID:</span>
					<code class="ml-2 px-2 py-1 bg-surface-muted rounded text-xs font-mono break-all">
						{workspaceId}
					</code>
				</div>
				
				<!-- Future workspace settings -->
				<div class="opacity-50">
					<p class="text-sm text-muted-foreground">More workspace settings coming soon</p>
				</div>
			</div>
		</section>

		<!-- Account Section -->
		<section>
			<h3 class="text-base font-medium text-foreground-base mb-4">Account</h3>
			<div class="space-y-3">
				<Button 
					variant="outline" 
					class="w-full justify-start min-h-[44px] touch-manipulation" 
					disabled
				>
					Export Data
				</Button>
				<Button 
					variant="outline" 
					class="w-full justify-start min-h-[44px] touch-manipulation text-error border-error-border hover:bg-error-alert-bg" 
					disabled
				>
					Delete Account
				</Button>
				<p class="text-xs text-muted-foreground">Account management features coming soon</p>
			</div>
		</section>
	</div>
</div>

<!-- Notion Integration Dialog -->
<NotionIntegrationDialog
	isOpen={showNotionDialog}
	{workspaceId}
	{availableDatabases}
	loading={loadingDatabases}
	error={databaseLoadError}
	onClose={handleCloseNotionDialog}
	onConnect={handleConnectNotionDatabase}
	onRetry={handleRetryDatabaseLoad}
/>

<!-- Guest Upgrade Prompt Dialog -->
{#if showGuestUpgradePrompt}
	<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div class="bg-surface-base rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
			<div class="flex items-start gap-3">
				<div class="flex-shrink-0 mt-0.5">
					<Database class="w-6 h-6 text-primary" />
				</div>
				<div class="flex-1">
					<h3 class="text-lg font-semibold text-foreground-base mb-2">
						Unlock Notion Integration
					</h3>
					<p class="text-sm text-foreground-secondary mb-4">
						Connect your tasks with Notion to sync across devices, collaborate with your team, and never lose your work.
					</p>
					
					<!-- Benefits list -->
					<div class="space-y-2 mb-4">
						<div class="flex items-center gap-2 text-sm">
							<CheckCircle class="w-4 h-4 text-success flex-shrink-0" />
							<span class="text-foreground-secondary">Sync with your Notion databases</span>
						</div>
						<div class="flex items-center gap-2 text-sm">
							<CheckCircle class="w-4 h-4 text-success flex-shrink-0" />
							<span class="text-foreground-secondary">Access tasks from anywhere</span>
						</div>
						<div class="flex items-center gap-2 text-sm">
							<CheckCircle class="w-4 h-4 text-success flex-shrink-0" />
							<span class="text-foreground-secondary">Collaborate with your team</span>
						</div>
						<div class="flex items-center gap-2 text-sm">
							<CheckCircle class="w-4 h-4 text-success flex-shrink-0" />
							<span class="text-foreground-secondary">Keep your tasks permanently</span>
						</div>
					</div>
					
					<!-- Task preservation notice -->
					<div class="p-3 bg-info-alert-bg border border-info-border rounded-lg mb-4">
						<p class="text-xs text-info-foreground">
							<strong>Don't worry!</strong> All your current tasks will be preserved when you create an account.
						</p>
					</div>
				</div>
			</div>
			
			<!-- Action buttons -->
			<div class="flex flex-col sm:flex-row gap-3 pt-2">
				<Button
					onclick={handleGuestSignUp}
					variant="primary"
					class="flex-1 bg-primary hover:bg-primary-button-hover text-primary-foreground min-h-[44px]"
				>
					Create Free Account
				</Button>
				<Button
					onclick={handleCloseGuestUpgradePrompt}
					variant="outline"
					class="flex-1 border-subtle-base text-foreground-secondary hover:bg-surface-muted min-h-[44px]"
				>
					Maybe Later
				</Button>
			</div>
		</div>
	</div>
{/if}