<script lang="ts">
import type { ExternalIntegration } from "@notion-task-manager/db";
import { Switch } from "bits-ui";
import {
	classifyOAuthError,
	initiateOAuth,
	OAuthRetryManager,
} from "$lib/utils/oauth";
import DatabaseSelector from "./DatabaseSelector.svelte";
import {
	CheckCircle,
	Clock,
	Database,
	Error as ErrorIcon,
	Spinner,
	X,
} from "./icons";
import { cn } from "./utils";

interface NotionDatabase {
	id: string;
	title: string;
	url?: string;
	icon?: {
		type: "emoji" | "external" | "file";
		emoji?: string;
		external?: { url: string };
		file?: { url: string };
	};
}

interface IntegrationStatus {
	status: "disconnected" | "disabled" | "synced" | "pending" | "error";
	lastSyncAt?: Date;
	lastError?: string;
	syncCount?: number;
	conflictCount?: number;
}

interface Props {
	integration?: ExternalIntegration;
	loading?: boolean;
	disabled?: boolean;
	workspaceId: string;
	onToggle: (enabled: boolean) => Promise<void>;
	onConfigure?: () => void;
	onStatusClick?: () => void;
	onOAuthSuccess?: (data: Record<string, unknown>) => void;
	onOAuthError?: (error: string) => void;
	onDatabaseChange?: (databaseId: string) => void;
	class?: string;
	// Enhanced status information
	integrationStatus?: IntegrationStatus;
	// Database selection
	availableDatabases?: NotionDatabase[];
	currentDatabase?: NotionDatabase | null;
	// Mobile optimization
	hapticFeedback?: boolean;
}

let {
	integration,
	loading = false,
	disabled = false,
	workspaceId,
	onToggle,
	onConfigure,
	onStatusClick,
	onOAuthSuccess,
	onOAuthError,
	onDatabaseChange,
	class: className = "",
	integrationStatus,
	availableDatabases = [],
	currentDatabase = null,
	hapticFeedback = true,
}: Props = $props();

let isToggling = $state(false);
let touchStartTime = $state(0);
let oauthError = $state<string | null>(null);
let retryManager = new OAuthRetryManager();

// Haptic feedback support detection
const supportsHaptics = $derived(() => {
	return typeof navigator !== "undefined" && "vibrate" in navigator;
});

// Trigger haptic feedback for mobile interactions
function triggerHapticFeedback(type: "light" | "medium" | "heavy" = "light") {
	if (!hapticFeedback || !supportsHaptics()) return;

	const patterns = {
		light: [10],
		medium: [20],
		heavy: [30],
	};

	navigator.vibrate(patterns[type]);
}

async function handleToggle() {
	if (isToggling || loading || disabled) return;

	// Trigger haptic feedback on interaction
	triggerHapticFeedback("medium");

	isToggling = true;
	oauthError = null;

	try {
		const newState = !integration?.syncEnabled;

		if (newState && !integration) {
			// Enabling integration for the first time - check if user has Notion tokens
			// If they do, show database selection; if not, initiate OAuth
			await handleIntegrationSetup();
		} else {
			// Just toggling existing integration
			await onToggle(newState);
		}
	} catch (error) {
		console.error("Toggle error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Failed to toggle integration";
		oauthError = errorMessage;

		if (onOAuthError) {
			onOAuthError(errorMessage);
		}
	} finally {
		isToggling = false;
	}
}

async function handleSwitchChange(checked: boolean) {
	if (isToggling || loading || disabled) return;

	// Trigger haptic feedback on interaction
	triggerHapticFeedback("medium");

	isToggling = true;
	oauthError = null;

	try {
		if (checked && !integration) {
			// Enabling integration for the first time - check if user has Notion tokens
			// If they do, show database selection; if not, initiate OAuth
			await handleIntegrationSetup();
		} else {
			// Just toggling existing integration
			await onToggle(checked);
		}
	} catch (error) {
		console.error("Toggle error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Failed to toggle integration";
		oauthError = errorMessage;

		if (onOAuthError) {
			onOAuthError(errorMessage);
		}
	} finally {
		isToggling = false;
	}
}

async function handleIntegrationSetup() {
	try {
		// First, check if user has Notion access tokens by trying to fetch databases
		const response = await fetch("/api/integrations/notion/databases");

		if (response.ok) {
			// User has tokens, show database selection dialog
			if (onConfigure) {
				onConfigure();
			} else {
				throw new Error("Database selection not available");
			}
		} else if (response.status === 401 || response.status === 403) {
			// User doesn't have tokens or they're invalid, initiate OAuth
			await handleOAuthFlow();
		} else {
			// Other error
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to check Notion access");
		}
	} catch (error) {
		console.error("Integration setup error:", error);
		throw error;
	}
}

async function handleOAuthFlow() {
	try {
		const result = await retryManager.retry(async () => {
			return await initiateOAuth({
				provider: "notion",
				workspaceId,
			});
		});

		if (!result.success) {
			throw new Error(result.error || "OAuth initiation failed");
		}

		// OAuth initiation successful - user will be redirected
		// The parent component should handle the callback
		if (onOAuthSuccess && result.data) {
			onOAuthSuccess(result.data as Record<string, unknown>);
		}
	} catch (error) {
		console.error("OAuth flow error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "OAuth failed";
		const classifiedError = classifyOAuthError(errorMessage);

		oauthError = classifiedError.message;

		if (onOAuthError) {
			onOAuthError(classifiedError.message);
		}

		throw error;
	}
}

async function handleRetryOAuth() {
	oauthError = null;
	retryManager.reset();
	await handleOAuthFlow();
}

function handleConfigure() {
	triggerHapticFeedback("light");
	if (onConfigure) {
		onConfigure();
	}
}

function handleStatusClick() {
	triggerHapticFeedback("light");
	if (onStatusClick) {
		onStatusClick();
	}
}

// Enhanced touch handling for mobile
function handleTouchStart() {
	touchStartTime = Date.now();
}

function handleTouchEnd(callback: () => void) {
	const touchDuration = Date.now() - touchStartTime;
	// Only trigger if it's a quick tap (not a long press)
	if (touchDuration < 500) {
		callback();
	}
}

// Determine comprehensive status
const status = $derived(() => {
	if (!integration) return "disconnected";
	if (!integration.syncEnabled) return "disabled";

	// Use enhanced status if available
	if (integrationStatus) {
		return integrationStatus.status;
	}

	// Fallback: check lastSyncAt to determine if recently synced
	if (integration.lastSyncAt) {
		const lastSync = new Date(integration.lastSyncAt);
		const now = new Date();
		const timeDiff = now.getTime() - lastSync.getTime();
		const fiveMinutes = 5 * 60 * 1000;

		// If last sync was within 5 minutes, consider it synced
		return timeDiff < fiveMinutes ? "synced" : "pending";
	}

	return "pending";
});

// Enhanced status configuration with semantic colors
const statusConfig = {
	disconnected: {
		label: "Not Connected",
		description: "Connect your Notion workspace to sync tasks",
		bgColor: "var(--surface-muted)",
		textColor: "var(--muted-foreground)",
		borderColor: "var(--subtle-base)",
		icon: Database,
		clickable: false,
	},
	disabled: {
		label: "Disabled",
		description: "Sync is disabled. Tasks won't sync with Notion.",
		bgColor: "var(--surface-muted)",
		textColor: "var(--muted-foreground)",
		borderColor: "var(--subtle-base)",
		icon: X,
		clickable: false,
	},
	synced: {
		label: "Synced",
		description: "Tasks are syncing with your Notion database",
		bgColor: "var(--success-alert-bg)",
		textColor: "var(--success-foreground)",
		borderColor: "var(--success-border)",
		icon: CheckCircle,
		clickable: true,
	},
	pending: {
		label: "Syncing",
		description: "Synchronizing tasks with Notion...",
		bgColor: "var(--warning-alert-bg)",
		textColor: "var(--warning-foreground)",
		borderColor: "var(--warning-border)",
		icon: Clock,
		clickable: true,
	},
	error: {
		label: "Error",
		description: "Sync failed. Tap for details.",
		bgColor: "var(--error-alert-bg)",
		textColor: "var(--error-foreground)",
		borderColor: "var(--error-border)",
		icon: ErrorIcon,
		clickable: true,
	},
};

const currentStatus = $derived(statusConfig[status()]);

// Format last sync time
const lastSyncText = $derived.by(() => {
	const lastSync =
		integrationStatus?.lastSyncAt ||
		(integration?.lastSyncAt ? new Date(integration.lastSyncAt) : null);
	if (!lastSync) return null;

	const now = new Date();
	const diff = now.getTime() - lastSync.getTime();
	const minutes = Math.floor(diff / (1000 * 60));
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	return `${days}d ago`;
});

// Sync statistics text
const syncStatsText = $derived.by(() => {
	if (!integrationStatus) return null;

	const parts = [];
	if (integrationStatus.syncCount) {
		parts.push(`${integrationStatus.syncCount} tasks synced`);
	}
	if (integrationStatus.conflictCount && integrationStatus.conflictCount > 0) {
		parts.push(`${integrationStatus.conflictCount} conflicts`);
	}

	return parts.length > 0 ? parts.join(", ") : null;
});

async function handleDatabaseChange(databaseId: string) {
	if (onDatabaseChange) {
		await onDatabaseChange(databaseId);
	}
}

async function handleSetupNotion() {
	await handleIntegrationSetup();
}
</script>

<div class={cn(
	'flex flex-col gap-3 p-4 bg-surface-base border border-subtle-base rounded-lg',
	disabled && 'opacity-60 pointer-events-none',
	className
)}>
	<!-- Header Section -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3 flex-1 min-w-0">
			<div class="flex-shrink-0">
				<Database class="w-5 h-5 text-foreground-secondary" />
			</div>
			<div class="min-w-0 flex-1">
				<h3 class="font-medium text-foreground-base text-sm">Notion Integration</h3>
			</div>
		</div>
		
		<!-- Status Badge -->
		<button
			onclick={currentStatus.clickable ? handleStatusClick : undefined}
			ontouchstart={currentStatus.clickable ? handleTouchStart : undefined}
			ontouchend={currentStatus.clickable ? () => handleTouchEnd(handleStatusClick) : undefined}
			disabled={!currentStatus.clickable}
			class={cn(
				'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200',
				'border flex-shrink-0',
				// Touch target optimization for mobile
				'min-h-[28px]',
				currentStatus.clickable && 'hover:opacity-80 active:scale-95 cursor-pointer',
				!currentStatus.clickable && 'cursor-default'
			)}
			style={`
				background-color: ${currentStatus.bgColor};
				color: ${currentStatus.textColor};
				border-color: ${currentStatus.borderColor};
			`}
			aria-label={currentStatus.clickable ? `${currentStatus.label} - Tap for details` : currentStatus.label}
		>
			{#if currentStatus.icon}
				{@const IconComponent = currentStatus.icon}
				<IconComponent class="w-3 h-3 flex-shrink-0" />
			{/if}
			<span class="whitespace-nowrap">{currentStatus.label}</span>
			
			<!-- Loading indicator overlay for pending status -->
			{#if status() === 'pending' || isToggling}
				<Spinner class="w-3 h-3" />
			{/if}
		</button>
	</div>

	<!-- Description -->
	<p class="text-xs text-foreground-secondary">
		{currentStatus.description}
	</p>

	<!-- Database Selector and Toggle Row -->
	<div class="flex items-center gap-2 flex-wrap">
		<!-- Database Selector -->
		<div class="flex-1 min-w-0">
			<DatabaseSelector
				databases={availableDatabases}
				currentDatabase={currentDatabase}
				onDatabaseChange={handleDatabaseChange}
				onSetupNotion={handleSetupNotion}
				disabled={disabled || loading}
				loading={loading}
			/>
		</div>

		{#if integration}
			<!-- Toggle Switch using bits-ui -->
			<div class="relative flex-shrink-0">
				<Switch.Root
					checked={integration.syncEnabled}
					onCheckedChange={handleSwitchChange}
					disabled={isToggling || loading || disabled}
					class="data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-muted inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Switch.Thumb class="pointer-events-none block h-4 w-4 rounded-full bg-surface-base shadow-sm transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
				</Switch.Root>
				
				<!-- Loading indicator overlay -->
				{#if isToggling}
					<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
						<Spinner class="w-3 h-3 text-primary" />
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Sync Information (Collapsible on Mobile) -->
	{#if lastSyncText || syncStatsText || (integrationStatus?.lastError && status() === 'error') || oauthError}
		<div class="flex flex-col gap-1 pt-1 border-t border-subtle-base">
			{#if lastSyncText}
				<p class="text-xs text-muted-foreground">
					Last synced: {lastSyncText}
				</p>
			{/if}
			
			{#if syncStatsText}
				<p class="text-xs text-muted-foreground">
					{syncStatsText}
				</p>
			{/if}
			
			{#if integrationStatus?.lastError && status() === 'error'}
				<p class="text-xs text-error font-medium">
					{integrationStatus.lastError}
				</p>
			{/if}
			
			{#if oauthError}
				<div class="flex items-center gap-2">
					<p class="text-xs text-error font-medium flex-1">
						{oauthError}
					</p>
					<button
						onclick={handleRetryOAuth}
						class="text-xs text-primary hover:text-primary-button-hover underline flex-shrink-0"
					>
						Retry
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Configure Button (Mobile Friendly) -->
	{#if integration && onConfigure}
		<button
			onclick={handleConfigure}
			ontouchstart={handleTouchStart}
			ontouchend={() => handleTouchEnd(handleConfigure)}
			class={cn(
				'w-full px-3 py-2 text-sm font-medium text-foreground-base bg-surface-muted',
				'hover:bg-subtle-hover active:bg-subtle-base rounded-md transition-all duration-200',
				'min-h-[44px] flex items-center justify-center gap-2',
				'active:scale-[0.98] border border-subtle-base'
			)}
			aria-label="Configure integration settings"
		>
			<Database class="w-4 h-4" />
			<span>Configure Integration</span>
		</button>
	{/if}
</div>