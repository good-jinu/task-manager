<script lang="ts">
import type { ExternalIntegration } from "@notion-task-manager/db";
import {
	classifyOAuthError,
	initiateOAuth,
	OAuthRetryManager,
} from "$lib/utils/oauth";
import {
	CheckCircle,
	Clock,
	Database,
	Error as ErrorIcon,
	Spinner,
	Warning,
	X,
} from "./icons";
import { Badge } from "./ui";
import { cn } from "./utils";

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
	class?: string;
	// Enhanced status information
	integrationStatus?: IntegrationStatus;
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
	class: className = "",
	integrationStatus,
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
			// Enabling integration for the first time - initiate OAuth
			await handleOAuthFlow();
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
</script>

<div class={cn(
	'flex items-center justify-between p-4 bg-surface-base border border-subtle-base rounded-lg',
	disabled && 'opacity-60 pointer-events-none',
	className
)}>
	<div class="flex items-center gap-3 flex-1 min-w-0">
		<div class="flex-shrink-0">
			<Database class="w-6 h-6 text-gray-600" />
		</div>
		
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 mb-1">
				<h3 class="font-medium text-gray-900">Notion Integration</h3>
				
				<!-- Enhanced Status Badge -->
				<button
					onclick={currentStatus.clickable ? handleStatusClick : undefined}
					ontouchstart={currentStatus.clickable ? handleTouchStart : undefined}
					ontouchend={currentStatus.clickable ? () => handleTouchEnd(handleStatusClick) : undefined}
					disabled={!currentStatus.clickable}
					class={cn(
						'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200',
						'border',
						// Touch target optimization for mobile
						'min-h-[32px] min-w-[32px]',
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
						<Spinner class="w-3 h-3 ml-1" />
					{/if}
				</button>
			</div>
			
			<!-- Status description -->
			<p class="text-sm text-gray-600 mb-1">
				{currentStatus.description}
			</p>
			
			<!-- Enhanced sync information -->
			<div class="flex flex-col gap-1">
				{#if lastSyncText}
					<p class="text-xs text-gray-500">
						Last synced: {lastSyncText}
					</p>
				{/if}
				
				{#if syncStatsText}
					<p class="text-xs text-gray-500">
						{syncStatsText}
					</p>
				{/if}
				
				{#if integrationStatus?.lastError && status() === 'error'}
					<p class="text-xs text-red-600 font-medium">
						{integrationStatus.lastError}
					</p>
				{/if}
				
				{#if oauthError}
					<div class="flex items-center gap-2 mt-1">
						<p class="text-xs text-red-600 font-medium">
							{oauthError}
						</p>
						<button
							onclick={handleRetryOAuth}
							class="text-xs text-blue-600 hover:text-blue-700 underline"
						>
							Retry
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Action buttons with enhanced mobile touch targets -->
	<div class="flex items-center gap-2 flex-shrink-0">
		{#if integration}
			<!-- Enhanced Toggle switch with better mobile interaction -->
			<button
				onclick={handleToggle}
				ontouchstart={handleTouchStart}
				ontouchend={() => handleTouchEnd(handleToggle)}
				disabled={isToggling || loading || disabled}
				class={cn(
					'relative inline-flex items-center justify-center rounded-full transition-all duration-200',
					'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
					'disabled:opacity-50 disabled:cursor-not-allowed',
					// Enhanced touch target for mobile (44px minimum)
					'min-w-[44px] min-h-[44px] p-2',
					// Visual feedback for touch interactions
					'active:scale-95 hover:shadow-md',
					integration.syncEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-200 hover:bg-gray-300'
				)}
				aria-label={integration.syncEnabled ? 'Disable sync' : 'Enable sync'}
			>
				<!-- Toggle switch visual -->
				<div class={cn(
					'relative w-11 h-6 rounded-full transition-colors',
					integration.syncEnabled ? 'bg-blue-600' : 'bg-gray-200'
				)}>
					<span
						class={cn(
							'absolute top-0.5 inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm',
							integration.syncEnabled ? 'translate-x-6' : 'translate-x-0.5'
						)}
					></span>
				</div>
				
				<!-- Loading indicator overlay -->
				{#if isToggling}
					<div class="absolute inset-0 flex items-center justify-center">
						<Spinner class="w-4 h-4 text-white" />
					</div>
				{/if}
			</button>

			<!-- Configure button with enhanced mobile touch target -->
			{#if onConfigure}
				<button
					onclick={handleConfigure}
					ontouchstart={handleTouchStart}
					ontouchend={() => handleTouchEnd(handleConfigure)}
					class={cn(
						'px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100',
						'hover:bg-gray-200 active:bg-gray-300 rounded-md transition-all duration-200',
						// Enhanced touch target for mobile
						'min-h-[44px] min-w-[44px] flex items-center justify-center',
						// Visual feedback for touch interactions
						'active:scale-95 hover:shadow-sm'
					)}
					aria-label="Configure integration settings"
				>
					Configure
				</button>
			{/if}
		{:else}
			<!-- Connect button with enhanced mobile interaction -->
			<button
				onclick={() => onToggle(true)}
				ontouchstart={handleTouchStart}
				ontouchend={() => handleTouchEnd(() => onToggle(true))}
				disabled={loading || disabled}
				class={cn(
					'px-4 py-2 text-sm font-medium text-white bg-blue-600',
					'hover:bg-blue-700 active:bg-blue-800 rounded-md transition-all duration-200',
					'disabled:opacity-50 disabled:cursor-not-allowed',
					// Enhanced touch target for mobile
					'min-h-[44px] flex items-center justify-center gap-2',
					// Visual feedback for touch interactions
					'active:scale-95 hover:shadow-md'
				)}
				aria-label="Connect to Notion workspace"
			>
				{#if loading}
					<Spinner class="w-4 h-4" />
				{/if}
				<span>Connect Notion</span>
			</button>
		{/if}
	</div>
</div>