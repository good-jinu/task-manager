<script lang="ts">
import {
	formatDatabaseMetadata,
	getDatabaseIcon,
} from "$lib/utils/database-cache";
import {
	hapticFeedback,
	progressiveEnhancement,
} from "$lib/utils/mobile-performance";
import {
	AlertCircle,
	ArrowRightAlt,
	Check,
	Close,
	Database,
	Info,
	NotionLogo,
	RefreshRounded,
	Spinner,
} from "./icons";
import { Alert, Button, Card } from "./ui";
import { cn } from "./utils";

interface NotionDatabase {
	id: string;
	name: string;
	url?: string;
	icon?: {
		type: "emoji" | "external" | "file";
		emoji?: string;
		external?: { url: string };
		file?: { url: string };
	};
	properties?: Record<string, unknown>;
	created_time?: string;
	last_edited_time?: string;
}

interface Props {
	isOpen: boolean;
	workspaceId: string;
	availableDatabases?: NotionDatabase[];
	loading?: boolean;
	error?: string | null;
	onClose: () => void;
	onConnect: (
		databaseId: string,
		databaseName: string,
		importExisting: boolean,
	) => Promise<void>;
	onRetry?: () => void;
	class?: string;
}

let {
	isOpen,
	workspaceId,
	availableDatabases = [],
	loading = false,
	error = null,
	onClose,
	onConnect,
	onRetry,
	class: className = "",
}: Props = $props();

let selectedDatabaseId = $state("");
let importExisting = $state(true);
let isConnecting = $state(false);
let step = $state<"select" | "connecting" | "success" | "error">("select");
let connectionError = $state<string | null>(null);

// Mobile performance optimizations
const capabilities = progressiveEnhancement.getCapabilities();
const shouldUseAnimations =
	progressiveEnhancement.shouldEnableFeature("animations");
const shouldUseHaptics = progressiveEnhancement.shouldEnableFeature("haptics");

// Reset state when dialog opens/closes
$effect(() => {
	if (isOpen) {
		step = "select";
		selectedDatabaseId = "";
		importExisting = true;
		isConnecting = false;
		connectionError = null;
	}
});

async function handleConnect() {
	if (!selectedDatabaseId || isConnecting || !selectedDatabase) return;

	isConnecting = true;
	step = "connecting";
	connectionError = null;

	// Haptic feedback for connection start
	if (shouldUseHaptics) {
		hapticFeedback.medium();
	}

	try {
		await onConnect(selectedDatabaseId, selectedDatabase.name, importExisting);
		step = "success";

		// Success haptic feedback
		if (shouldUseHaptics) {
			hapticFeedback.success();
		}

		// Auto-close after success (with reduced timing for low-end devices)
		const closeDelay = capabilities.isLowEndDevice ? 1500 : 2000;
		setTimeout(() => {
			onClose();
		}, closeDelay);
	} catch (error) {
		console.error("Connection failed:", error);
		step = "error";
		connectionError =
			error instanceof Error
				? error.message
				: "Failed to connect to Notion database";

		// Error haptic feedback
		if (shouldUseHaptics) {
			hapticFeedback.error();
		}
	} finally {
		isConnecting = false;
	}
}

function handleRetry() {
	if (onRetry) {
		onRetry();
	}
	step = "select";
	connectionError = null;

	// Light haptic feedback for retry
	if (shouldUseHaptics) {
		hapticFeedback.light();
	}
}

function handleClose() {
	if (!isConnecting) {
		onClose();
	}
}

// Enhanced touch handling for database selection
function handleDatabaseSelect(databaseId: string) {
	selectedDatabaseId = databaseId;

	// Light haptic feedback for selection
	if (shouldUseHaptics) {
		hapticFeedback.light();
	}
}

// Prevent background scroll when dialog is open
$effect(() => {
	if (typeof document === "undefined") return;

	if (isOpen) {
		document.body.style.overflow = "hidden";
	} else {
		document.body.style.overflow = "";
	}

	return () => {
		document.body.style.overflow = "";
	};
});

const selectedDatabase = $derived(
	availableDatabases.find((db) => db.id === selectedDatabaseId),
);
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4"
		role="button"
		tabindex="0"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Enter' && handleClose()}
	>
		<!-- Dialog -->
		<Card
			variant="elevated"
			padding="none"
			class={cn(
				// Mobile-first responsive sizing
				'w-full max-w-sm mx-auto max-h-[90vh] overflow-hidden',
				// Tablet sizing
				'sm:max-w-md',
				// Desktop sizing  
				'lg:max-w-lg',
				// Animation (conditional based on capabilities)
				shouldUseAnimations && 'animate-in fade-in-0 zoom-in-95',
				// Performance optimization for low-end devices
				capabilities.isLowEndDevice ? 'duration-100' : 'duration-200',
				// Progressive enhancement classes
				capabilities.hasTouch && 'has-touch',
				capabilities.isLowEndDevice && 'low-end-device',
				capabilities.prefersReducedMotion && 'prefers-reduced-motion',
				className
			)}
			onclick={(e) => e.stopPropagation()}
		>
			{#if step === 'select'}
				<!-- Header -->
				<div class="flex items-center justify-between p-4 sm:p-6 border-b border-subtle-base">
					<div class="flex items-center gap-3">
						<div class="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg">
							<NotionLogo class="w-6 h-6" />
						</div>
						<div>
							<h2 class="text-lg sm:text-xl font-semibold text-foreground-emphasis">
								Connect Notion Database
							</h2>
							<p class="text-sm text-muted-foreground">
								Choose a database to sync with
							</p>
						</div>
					</div>
					<button
						onclick={handleClose}
						class={cn(
							'p-2 rounded-lg text-muted-foreground hover:text-foreground-emphasis',
							'hover:bg-surface-muted transition-colors',
							'min-w-[44px] min-h-[44px] flex items-center justify-center',
							'focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2'
						)}
						aria-label="Close dialog"
					>
						<Close class="w-5 h-5" />
					</button>
				</div>

				<!-- Content -->
				<div class="p-4 sm:p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
					<!-- Error Alert -->
					{#if error}
						<Alert variant="error" class="mb-4">
							<AlertCircle class="w-4 h-4" />
							<div>
								<p class="font-medium">Connection Error</p>
								<p class="text-sm mt-1">{error}</p>
								{#if onRetry}
									<Button
										onclick={handleRetry}
										variant="outline"
										size="sm"
										class="mt-2"
									>
										<RefreshRounded class="w-4 h-4 mr-2" />
										Try Again
									</Button>
								{/if}
							</div>
						</Alert>
					{/if}

					<!-- Database selection -->
					<div>
						<label for="database-select" class="block text-sm font-medium text-foreground-emphasis mb-3">
							Select a Notion database to sync with this workspace
						</label>
						
						{#if loading}
							<div class="flex flex-col items-center justify-center py-12">
								<Spinner class="w-8 h-8 text-primary mb-3" />
								<p class="text-sm text-muted-foreground mb-1">Loading your databases...</p>
								<p class="text-xs text-muted-foreground text-center">
									This may take a few seconds
								</p>
							</div>
						{:else if availableDatabases.length === 0}
							<div class="text-center py-12">
								<div class="flex items-center justify-center w-16 h-16 bg-surface-muted rounded-full mx-auto mb-4">
									<Database class="w-8 h-8 text-muted-foreground" />
								</div>
								<h3 class="text-sm font-medium text-foreground-emphasis mb-2">No databases found</h3>
								<p class="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
									Make sure you have databases in your Notion workspace and have granted access to this app.
								</p>
								{#if onRetry}
									<Button
										onclick={handleRetry}
										variant="outline"
										size="sm"
									>
										<RefreshRounded class="w-4 h-4 mr-2" />
										Refresh
									</Button>
								{/if}
							</div>
						{:else}
							<div class="space-y-3">
								{#each availableDatabases as database}
    <!-- 
        1. Change <label> to <button type="button">. 
        2. Add role="radio" and aria-checked for screen readers.
        3. Add w-full and text-left to maintain the original layout.
    -->
    <button
        type="button"
        class={cn(
            'flex items-start p-4 border rounded-xl cursor-pointer transition-all w-full text-left',
            'hover:bg-surface-muted hover:border-subtle-hover',
            // Touch-friendly sizing
            'min-h-[60px]',
            // Performance optimization for low-end devices
            capabilities.isLowEndDevice ? 'duration-100' : 'duration-200',
            // Progressive enhancement classes
            capabilities.hasTouch && 'touch-manipulation select-none',
            selectedDatabaseId === database.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-subtle-base'
        )}
        onclick={() => handleDatabaseSelect(database.id)}
        role="radio"
        aria-checked={selectedDatabaseId === database.id}
    >
        <!-- Database Icon -->
        <div class="flex items-start gap-3 flex-1 min-w-0">
            <div class="flex items-center justify-center w-10 h-10 bg-surface-muted rounded-lg flex-shrink-0 mt-0.5">
                {#if getDatabaseIcon(database).type === 'emoji'}
                    <span class="text-lg">{getDatabaseIcon(database).content}</span>
                {:else}
                    <Database 
                        class={cn(
                            'w-5 h-5',
                            selectedDatabaseId === database.id ? 'text-primary' : 'text-muted-foreground'
                        )} 
                    />
                {/if}
            </div>
            
            <!-- Database Info -->
            <div class="flex-1 min-w-0">
                <p class="font-medium text-foreground-emphasis truncate text-sm sm:text-base">
                    {database.name}
                </p>
                {#if database.url}
                    <p class="text-xs text-muted-foreground truncate mt-0.5">
                        {database.url}
                    </p>
                {/if}
                {#if formatDatabaseMetadata(database)}
                    <p class="text-xs text-muted-foreground mt-1">
                        {formatDatabaseMetadata(database)}
                    </p>
                {/if}
            </div>
        </div>
        
        <!-- Selection Indicator -->
        {#if selectedDatabaseId === database.id}
            <div class="flex items-center justify-center w-6 h-6 bg-primary rounded-full flex-shrink-0 mt-2">
                <Check class="w-4 h-4 text-primary-foreground" />
            </div>
        {:else}
            <div class="w-6 h-6 border-2 border-subtle-base rounded-full flex-shrink-0 mt-2"></div>
        {/if}
    </button>
{/each}
							</div>
						{/if}
					</div>

					<!-- Import option -->
					{#if selectedDatabase}
						<div class="bg-info-alert-bg border border-info-border rounded-xl p-4">
							<div class="flex items-start gap-3">
								<input
									id="import-existing"
									type="checkbox"
									bind:checked={importExisting}
									class={cn(
										'mt-1 w-5 h-5 text-primary border-subtle-base rounded',
										'focus:ring-primary focus:ring-2 focus:ring-offset-2',
										'min-w-[20px] min-h-[20px]' // Touch-friendly sizing
									)}
								/>
								<div class="flex-1">
									<label for="import-existing" class="text-sm font-medium text-foreground-emphasis cursor-pointer block">
										Import existing tasks from this database
									</label>
									<p class="text-xs text-muted-foreground mt-2 leading-relaxed">
										This will create internal copies of all tasks currently in the selected Notion database. 
										You can always sync new tasks later.
									</p>
									<div class="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
										<Info class="w-3 h-3 flex-shrink-0" />
										<span>Recommended for existing databases with tasks</span>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Actions -->
				<div class="p-4 sm:p-6 border-t border-subtle-base bg-surface-muted/50">
					<div class="flex flex-col-reverse sm:flex-row gap-3">
						<Button
							onclick={handleClose}
							variant="outline"
							disabled={isConnecting}
							class="flex-1 sm:flex-none min-h-[44px]"
						>
							Cancel
						</Button>
						<Button
							onclick={handleConnect}
							variant="primary"
							class="flex-1 min-h-[44px]"
							disabled={!selectedDatabaseId || isConnecting || loading || !selectedDatabase}
						>
							<span class="flex items-center justify-center gap-2">
								Connect Database
								<ArrowRightAlt class="w-4 h-4" />
							</span>
						</Button>
					</div>
				</div>

			{:else if step === 'connecting'}
				<!-- Connecting state -->
				<div class="p-6 sm:p-8">
					<div class="text-center py-8">
						<div class="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto mb-6">
							<Spinner class="w-8 h-8 text-primary" />
						</div>
						<h3 class="text-lg font-medium text-foreground-emphasis mb-3">
							Connecting to Notion
						</h3>
						<p class="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
							{#if importExisting}
								Setting up sync and importing existing tasks from <strong>{selectedDatabase?.name}</strong>...
							{:else}
								Setting up sync with <strong>{selectedDatabase?.name}</strong>...
							{/if}
						</p>
						<div class="mt-6 text-xs text-muted-foreground">
							This may take a few moments
						</div>
					</div>
				</div>

			{:else if step === 'success'}
				<!-- Success state -->
				<div class="p-6 sm:p-8">
					<div class="text-center py-8">
						<div class="w-16 h-16 bg-success-alert-bg rounded-full flex items-center justify-center mx-auto mb-6">
							<Check class="w-8 h-8 text-success" />
						</div>
						<h3 class="text-lg font-medium text-foreground-emphasis mb-3">
							Connected Successfully!
						</h3>
						<p class="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
							Your workspace is now synced with <strong>{selectedDatabase?.name}</strong>.
							{#if importExisting}
								Existing tasks are being imported in the background.
							{/if}
						</p>
					</div>
				</div>

			{:else if step === 'error'}
				<!-- Error state -->
				<div class="p-6 sm:p-8">
					<div class="text-center py-8">
						<div class="w-16 h-16 bg-error-alert-bg rounded-full flex items-center justify-center mx-auto mb-6">
							<AlertCircle class="w-8 h-8 text-error" />
						</div>
						<h3 class="text-lg font-medium text-foreground-emphasis mb-3">
							Connection Failed
						</h3>
						<p class="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed mb-6">
							{connectionError || "Unable to connect to the selected Notion database. Please try again."}
						</p>
						<div class="flex flex-col sm:flex-row gap-3 justify-center">
							<Button
								onclick={() => step = 'select'}
								variant="outline"
								size="sm"
							>
								Back to Selection
							</Button>
							<Button
								onclick={handleConnect}
								variant="primary"
								size="sm"
								disabled={!selectedDatabaseId || !selectedDatabase}
							>
								<RefreshRounded class="w-4 h-4 mr-2" />
								Try Again
							</Button>
						</div>
					</div>
				</div>
			{/if}
		</Card>
	</div>
{/if}

<style>
	@keyframes animate-in {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.animate-in {
		animation: animate-in 0.2s ease-out;
	}

	/* Respect reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.animate-in {
			animation: none;
		}
	}
</style>