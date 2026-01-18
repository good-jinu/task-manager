<script lang="ts">
import type { CreateQueryResult } from "@tanstack/svelte-query";
import { goto } from "$app/navigation";
import {
	useConnectDatabase,
	useDatabases,
	useDisconnectIntegration,
	useIntegrations,
	useToggleIntegration,
} from "$lib/queries";
import {
	lazyLoader,
	lazyOnHover,
	preloadIntegrationResources,
} from "$lib/utils/lazy-loading";
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

interface Props {
	isOpen: boolean;
	workspaceId: string;
	workspaceName?: string;
	isGuestMode?: boolean;
	onClose: () => void;
	onConnectNotion: (
		databaseId: string,
		databaseName: string,
		importExisting: boolean,
	) => Promise<void>;
	onSignUp?: () => void;
	class?: string;
}

let {
	isOpen,
	workspaceId,
	workspaceName: initialWorkspaceName = "My Tasks",
	isGuestMode = false,
	onClose,
	onConnectNotion,
	onSignUp,
	class: className = "",
}: Props = $props();

let showNotionDialog = $state(false);
let showGuestUpgradePrompt = $state(false);
let showDeleteWorkspaceDialog = $state(false);
let isDeleting = $state(false);
let isEditingWorkspaceName = $state(false);
let workspaceName = $state("");
let isSavingWorkspaceName = $state(false);

// Use TanStack Query hooks - make them reactive to workspaceId changes
let databasesQuery = $state<ReturnType<typeof useDatabases> | null>(null);
let integrationsQuery = $state<ReturnType<typeof useIntegrations> | null>(null);
let toggleIntegrationMutation = $state<ReturnType<
	typeof useToggleIntegration
> | null>(null);
let connectDatabaseMutation = $state<ReturnType<
	typeof useConnectDatabase
> | null>(null);
let disconnectIntegrationMutation = $state<ReturnType<
	typeof useDisconnectIntegration
> | null>(null);

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

const integrations = $derived(integrationsQuery?.data || []);
const statusLoading = $derived(integrationsQuery?.isLoading || false);

// Find Notion integration from query data
const notionIntegration = $derived(
	integrations.find((item) => item.integration.provider === "notion") || null,
);

// Transform Integration to IntegrationConfig for the toggle component
const integrationConfig = $derived.by(() => {
	if (!notionIntegration?.integration) return undefined;

	const integration = notionIntegration.integration;
	return {
		enabled: integration.syncEnabled,
		databaseId: integration.config?.databaseId,
		lastSyncAt: integration.lastSyncAt,
	};
});

// Enhanced drawer management with preloading
$effect(() => {
	if (typeof document === "undefined") return;

	if (isOpen) {
		// Preload integration resources
		preloadIntegrationResources(workspaceId);

		// Preload components that might be needed
		lazyLoader.preloadForTrigger("settingsOpen");

		// Reset workspace name when drawer opens
		workspaceName = initialWorkspaceName;
		isEditingWorkspaceName = false;
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
		});
	} catch (error) {
		console.error("Failed to toggle integration:", error);
		// Error handling is managed by the mutation
	}
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
	databaseName: string,
	importExisting: boolean,
) {
	try {
		await connectDatabaseMutation?.mutateAsync({
			workspaceId,
			databaseId,
			databaseName,
			importExisting,
		});

		// Call the parent handler to update the integrations list
		await onConnectNotion(databaseId, databaseName, importExisting);

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

// Wrapper function for database change events that don't have databaseName
async function handleDatabaseChange(
	databaseId: string,
	importExisting?: boolean,
) {
	const shouldImportExisting = importExisting ?? false;
	const database = availableDatabases.find(
		(db: NotionDatabase) => db.id === databaseId,
	);
	const databaseName = database?.name || database?.title || "Unknown Database";

	await handleConnectNotionDatabase(
		databaseId,
		databaseName,
		shouldImportExisting,
	);
}

function handleDeleteWorkspace() {
	showDeleteWorkspaceDialog = true;
}

function handleCloseDeleteWorkspaceDialog() {
	showDeleteWorkspaceDialog = false;
}

async function handleConfirmDeleteWorkspace() {
	if (isDeleting) return;

	isDeleting = true;

	try {
		const response = await fetch(
			`/api/workspaces/${workspaceId}?taskPolicy=delete`,
			{
				method: "DELETE",
			},
		);

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to delete workspace");
		}

		// Close dialogs and redirect to home
		showDeleteWorkspaceDialog = false;
		onClose();

		// Redirect to home page
		goto("/");
	} catch (error) {
		console.error("Failed to delete workspace:", error);
		// You could add a toast notification here
		alert(
			error instanceof Error ? error.message : "Failed to delete workspace",
		);
	} finally {
		isDeleting = false;
	}
}

function handleEditWorkspaceName() {
	isEditingWorkspaceName = true;
}

function handleCancelEditWorkspaceName() {
	isEditingWorkspaceName = false;
	workspaceName = initialWorkspaceName;
}

async function handleSaveWorkspaceName() {
	if (isSavingWorkspaceName || !workspaceName.trim()) return;

	isSavingWorkspaceName = true;

	try {
		const response = await fetch(`/api/workspaces/${workspaceId}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: workspaceName.trim(),
			}),
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to update workspace name");
		}

		// Success - exit edit mode
		isEditingWorkspaceName = false;

		// Reload the page to reflect the new workspace name
		window.location.reload();
	} catch (error) {
		console.error("Failed to update workspace name:", error);
		alert(
			error instanceof Error
				? error.message
				: "Failed to update workspace name",
		);
	} finally {
		isSavingWorkspaceName = false;
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
						integration={integrationConfig}
						workspaceId={workspaceId}
						disabled={isGuestMode}
						loading={loadingDatabases}
						onToggle={handleNotionToggle}
						onDatabaseChange={handleDatabaseChange}
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
					/>
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
			<div class="space-y-3">
				<!-- Workspace Name -->
				<div class="p-3 bg-surface-muted rounded-lg">
					<div class="text-xs text-foreground-secondary mb-2">Workspace Name</div>
					{#if isEditingWorkspaceName}
						<div class="space-y-2">
							<input
								type="text"
								bind:value={workspaceName}
								placeholder="Enter workspace name"
								class="w-full px-3 py-2 text-sm bg-surface-base border border-subtle-base rounded-md text-foreground-base placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
								maxlength="100"
								disabled={isSavingWorkspaceName}
							/>
							<div class="flex gap-2">
								<Button
									onclick={handleSaveWorkspaceName}
									variant="primary"
									size="sm"
									disabled={isSavingWorkspaceName || !workspaceName.trim()}
									class="flex-1 min-h-[36px]"
								>
									{#if isSavingWorkspaceName}
										Saving...
									{:else}
										Save
									{/if}
								</Button>
								<Button
									onclick={handleCancelEditWorkspaceName}
									variant="outline"
									size="sm"
									disabled={isSavingWorkspaceName}
									class="flex-1 min-h-[36px]"
								>
									Cancel
								</Button>
							</div>
						</div>
					{:else}
						<div class="flex items-center justify-between gap-2">
							<span class="text-sm font-medium text-foreground-base break-all">
								{initialWorkspaceName}
							</span>
							<button
								onclick={handleEditWorkspaceName}
								class="px-3 py-1.5 text-xs text-primary hover:text-primary-button-hover hover:bg-primary/10 rounded-md transition-colors flex-shrink-0"
								aria-label="Edit workspace name"
							>
								Edit
							</button>
						</div>
					{/if}
				</div>
				
				<!-- Workspace ID -->
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
			<h3 class="text-base font-medium text-foreground-base mb-3">Workspace Management</h3>
			<div class="space-y-2">
				<Button 
					onclick={handleDeleteWorkspace}
					variant="outline" 
					class="w-full justify-center min-h-[44px] touch-manipulation text-error border-error-border hover:bg-error-alert-bg text-sm" 
				>
					Delete Workspace
				</Button>
				<p class="text-xs text-muted-foreground px-1">This will permanently delete all tasks and data in this workspace</p>
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

<!-- Delete Workspace Confirmation Dialog -->
{#if showDeleteWorkspaceDialog}
	<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div class="bg-surface-base rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
			<div class="flex items-start gap-3">
				<div class="flex-shrink-0 mt-0.5">
					<div class="w-6 h-6 bg-error rounded-full flex items-center justify-center">
						<span class="text-white text-sm font-bold">!</span>
					</div>
				</div>
				<div class="flex-1">
					<h3 class="text-lg font-semibold text-foreground-base mb-2">
						Delete Workspace
					</h3>
					<p class="text-sm text-foreground-secondary mb-4">
						Are you sure you want to delete this workspace? This action cannot be undone.
					</p>
					
					<!-- Warning list -->
					<div class="space-y-2 mb-4">
						<div class="flex items-center gap-2 text-sm">
							<span class="w-4 h-4 text-error flex-shrink-0">×</span>
							<span class="text-foreground-secondary">All tasks will be permanently deleted</span>
						</div>
						<div class="flex items-center gap-2 text-sm">
							<span class="w-4 h-4 text-error flex-shrink-0">×</span>
							<span class="text-foreground-secondary">All integrations will be disconnected</span>
						</div>
						<div class="flex items-center gap-2 text-sm">
							<span class="w-4 h-4 text-error flex-shrink-0">×</span>
							<span class="text-foreground-secondary">This action cannot be undone</span>
						</div>
					</div>
					
					<!-- Workspace ID confirmation -->
					<div class="p-3 bg-surface-muted border border-subtle-base rounded-lg mb-4">
						<p class="text-xs text-foreground-secondary mb-1">Workspace ID:</p>
						<code class="text-xs font-mono text-foreground-base break-all">
							{workspaceId}
						</code>
					</div>
				</div>
			</div>
			
			<!-- Action buttons -->
			<div class="flex flex-col sm:flex-row gap-3 pt-2">
				<Button
					onclick={handleConfirmDeleteWorkspace}
					variant="outline"
					disabled={isDeleting}
					class="flex-1 bg-error hover:bg-error-button-hover text-white border-error min-h-[44px]"
				>
					{#if isDeleting}
						Deleting...
					{:else}
						Delete Workspace
					{/if}
				</Button>
				<Button
					onclick={handleCloseDeleteWorkspaceDialog}
					variant="outline"
					disabled={isDeleting}
					class="flex-1 border-subtle-base text-foreground-secondary hover:bg-surface-muted min-h-[44px]"
				>
					Cancel
				</Button>
			</div>
		</div>
	</div>
{/if}