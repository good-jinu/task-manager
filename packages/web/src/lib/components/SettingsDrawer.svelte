<script lang="ts">
import {
	useConnectDatabase,
	useDatabases,
	useDisconnectIntegration,
	useIntegrations,
	useToggleIntegration,
} from "$lib/queries";
import { refreshIntegrationStatus } from "$lib/stores/integration-status";
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
	Database,
	KeyboardArrowRight,
	RefreshRounded,
} from "./icons";
import NotionIntegrationDialog from "./NotionIntegrationDialog.svelte";
import { Button, Drawer } from "./ui";
import { cn } from "./utils";

interface NotionDatabase {
	id: string;
	name: string;
	title: string;
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
let showGuestUpgradePrompt = $state(false);

// Use TanStack Query hooks - make them reactive to workspaceId changes
let databasesQuery = $state<any>(null);
let integrationsQuery = $state<any>(null);
let toggleIntegrationMutation = $state<any>(null);
let connectDatabaseMutation = $state<any>(null);
let disconnectIntegrationMutation = $state<any>(null);

$effect(() => {
	if (workspaceId) {
		databasesQuery = useDatabases(workspaceId);
		integrationsQuery = useIntegrations(workspaceId);
		toggleIntegrationMutation = useToggleIntegration(workspaceId);
		connectDatabaseMutation = useConnectDatabase(workspaceId);
		disconnectIntegrationMutation = useDisconnectIntegration(workspaceId);
	}
});

// Derived data from queries
const availableDatabases = $derived(
	(databasesQuery?.data as NotionDatabase[]) || [],
);
const loadingDatabases = $derived(databasesQuery?.isLoading || false);
const databaseLoadError = $derived(databasesQuery?.error?.message || null);

const integrations = $derived((integrationsQuery?.data as any[]) || []);
const statusLoading = $derived(integrationsQuery?.isLoading || false);

// Find Notion integration from query data
const notionIntegration = $derived(
	integrations.find((item: any) => item.integration.provider === "notion") ||
		null,
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
		// Preload integration resources
		preloadIntegrationResources(workspaceId);

		// Preload components that might be needed
		lazyLoader.preloadForTrigger("settingsOpen");
	}
});

async function handleRefreshStatus() {
	// Refetch integrations data
	integrationsQuery?.refetch();
}

async function handleNotionToggle(enabled: boolean) {
	// Check if user is in guest mode and trying to enable integration
	if (enabled && isGuestMode) {
		showGuestUpgradePrompt = true;
		return;
	}

	try {
		await toggleIntegrationMutation?.mutateAsync({
			integrationId: notionIntegration?.integration.id,
			workspaceId,
			provider: "notion",
			enabled,
		} as any);
	} catch (error) {
		console.error("Failed to toggle integration:", error);
		// Error handling is managed by the mutation
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

	// Show dialog - databases will be loaded by the query
	showNotionDialog = true;
}

function handleRetryDatabaseLoad() {
	// Refetch databases
	databasesQuery?.refetch();
}

async function handleDisconnectNotion() {
	if (notionIntegration) {
		try {
			await disconnectIntegrationMutation?.mutateAsync(
				notionIntegration.integration.id,
			);
		} catch (error) {
			console.error("Failed to disconnect integration:", error);
		}
	}
}

function handleCloseNotionDialog() {
	showNotionDialog = false;
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
	importExisting?: boolean,
) {
	try {
		// If this is just a database change (not from dialog), use default import setting
		const shouldImportExisting = importExisting ?? false;

		const database = availableDatabases.find(
			(db: NotionDatabase) => db.id === databaseId,
		);

		await connectDatabaseMutation?.mutateAsync({
			workspaceId,
			databaseId,
			databaseName: database?.name || database?.title || "Unknown Database",
			importExisting: shouldImportExisting,
		} as any);

		// Call the parent handler to update the integrations list
		await onConnectNotion(databaseId, shouldImportExisting);

		// Close dialog if it was open
		if (showNotionDialog) {
			showNotionDialog = false;
		}
	} catch (error) {
		console.error("Failed to connect database:", error);
		// The error will be handled by the mutation
		throw error;
	}
}
</script>

<Drawer
	{isOpen}
	title="Settings"
	size="lg"
	{onClose}
	class={className}
>
		<!-- Integrations Section -->
		<section>
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-base font-medium text-foreground-base">Integrations</h3>
				{#if notionIntegration}
					<button
						onclick={handleRefreshStatus}
						disabled={statusLoading}
						class={cn(
							'p-2 rounded-lg text-muted-foreground hover:text-foreground-base',
							'hover:bg-surface-muted active:bg-surface-muted/80 transition-colors',
							'min-w-[44px] min-h-[44px] flex items-center justify-center',
							'touch-manipulation select-none',
							statusLoading && 'animate-spin'
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
						loading={loadingDatabases}
						onToggle={handleNotionToggle}
						onConfigure={notionIntegration ? handleConfigureNotion : undefined}
						onDatabaseChange={handleConnectNotionDatabase}
						availableDatabases={availableDatabases.map((db: NotionDatabase) => ({
							id: db.id,
							title: db.name || db.title,
							url: db.url
						}))}
						currentDatabase={(() => {
							const dbId = notionIntegration?.integration.config?.databaseId;
							const dbName = notionIntegration?.integration.config?.databaseName;
							const foundDb = availableDatabases.find((db: NotionDatabase) => db.id === dbId);
							
							if (dbId && dbName) {
								return {
									id: dbId as string,
									title: dbName as string,
									url: foundDb?.url
								};
							}
							return null;
						})()}
						integrationStatus={currentIntegrationStatusForToggle || undefined}
					/>

					{#if notionIntegration}
						<!-- Additional Actions (Mobile Optimized) -->
						<div class="flex flex-col gap-2 px-4">
							<button
								onclick={handleConfigureNotion}
								use:lazyOnHover={'NotionIntegrationDialog'}
								class={cn(
									'flex items-center justify-between w-full text-sm text-primary hover:text-primary-button-hover',
									'active:text-primary-button-active transition-colors',
									'min-h-[44px] px-3 py-2 rounded-lg border border-subtle-base',
									'hover:bg-surface-muted active:bg-surface-raised',
									'touch-manipulation select-none'
								)}
							>
								<div class="flex items-center gap-2">
									<Database class="w-4 h-4 flex-shrink-0" />
									<span>Change Database</span>
								</div>
								<KeyboardArrowRight class="w-4 h-4 flex-shrink-0" />
							</button>
							
							<button
								onclick={handleDisconnectNotion}
								class={cn(
									'flex items-center justify-center w-full text-sm text-error hover:text-error-button-hover',
									'active:text-error transition-colors',
									'min-h-[44px] px-3 py-2 rounded-lg border border-error-border',
									'hover:bg-error-alert-bg/50 active:bg-error-alert-bg',
									'touch-manipulation select-none'
								)}
							>
								<span>Disconnect Notion</span>
							</button>
						</div>

						<!-- Sync Statistics (Compact Mobile View) -->
						{#if syncStats}
							<div class="mx-4 bg-surface-muted rounded-lg p-3">
								<h4 class="text-sm font-medium text-foreground-base mb-2">Sync Statistics</h4>
								<div class="grid grid-cols-3 gap-2 text-xs">
									<div class="text-center">
										<div class="font-medium text-foreground-base">{syncStats.totalTasks}</div>
										<div class="text-muted-foreground">Total</div>
									</div>
									<div class="text-center">
										<div class="font-medium text-success">{syncStats.syncedTasks}</div>
										<div class="text-muted-foreground">Synced</div>
									</div>
									<div class="text-center">
										<div class="font-medium text-error">{syncStats.errorTasks}</div>
										<div class="text-muted-foreground">Errors</div>
									</div>
								</div>
								{#if syncStats.lastSyncDuration}
									<div class="text-xs text-muted-foreground mt-2 text-center">
										Last sync: {syncStats.lastSyncDuration}ms
									</div>
								{/if}
							</div>
						{/if}
					{/if}
				</div>

				<!-- Future integrations placeholder -->
				<div class="space-y-2 opacity-50 pointer-events-none">
					<div class="flex items-center justify-between p-3 bg-surface-muted border border-subtle-base rounded-lg">
						<div class="flex items-center gap-3 min-w-0">
							<div class="w-5 h-5 bg-subtle-base rounded flex-shrink-0"></div>
							<div class="min-w-0">
								<h4 class="font-medium text-muted-foreground text-sm">Google Calendar</h4>
								<p class="text-xs text-muted-foreground">Coming soon</p>
							</div>
						</div>
						<div class="w-8 h-4 bg-subtle-base rounded-full flex-shrink-0"></div>
					</div>

					<div class="flex items-center justify-between p-3 bg-surface-muted border border-subtle-base rounded-lg">
						<div class="flex items-center gap-3 min-w-0">
							<div class="w-5 h-5 bg-subtle-base rounded flex-shrink-0"></div>
							<div class="min-w-0">
								<h4 class="font-medium text-muted-foreground text-sm">Slack</h4>
								<p class="text-xs text-muted-foreground">Coming soon</p>
							</div>
						</div>
						<div class="w-8 h-4 bg-subtle-base rounded-full flex-shrink-0"></div>
					</div>
				</div>
			</div>
		</section>

		<!-- Workspace Section -->
		<section>
			<h3 class="text-base font-medium text-foreground-base mb-3">Workspace</h3>
			<div class="space-y-2">
				<div class="p-3 bg-surface-muted rounded-lg">
					<div class="text-xs text-foreground-secondary mb-1">Workspace ID</div>
					<code class="text-xs font-mono text-foreground-base break-all">
						{workspaceId}
					</code>
				</div>
				
				<!-- Future workspace settings -->
				<p class="text-xs text-muted-foreground px-1">More workspace settings coming soon</p>
			</div>
		</section>

		<!-- Account Section -->
		<section>
			<h3 class="text-base font-medium text-foreground-base mb-3">Account</h3>
			<div class="space-y-2">
				<Button 
					variant="outline" 
					class="w-full justify-center min-h-[44px] touch-manipulation text-sm" 
					disabled
				>
					Export Data
				</Button>
				<Button 
					variant="outline" 
					class="w-full justify-center min-h-[44px] touch-manipulation text-error border-error-border hover:bg-error-alert-bg text-sm" 
					disabled
				>
					Delete Account
				</Button>
				<p class="text-xs text-muted-foreground px-1">Account management features coming soon</p>
			</div>
		</section>
</Drawer>

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