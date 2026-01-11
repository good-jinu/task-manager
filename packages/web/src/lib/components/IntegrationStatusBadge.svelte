<script lang="ts">
import type { ExternalIntegration, SyncStatus } from "@notion-task-manager/db";
import {
	hapticFeedback,
	progressiveEnhancement,
	touchGestures,
} from "$lib/utils/mobile-performance";
import {
	CheckCircle,
	Clock,
	Database,
	Error as ErrorIcon,
	Spinner,
	Warning,
	X,
} from "./icons";
import { cn } from "./utils";

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

interface Props {
	integration?: ExternalIntegration;
	syncStatus?: SyncStatus;
	integrationStatus?: IntegrationStatus;
	syncStats?: SyncStatistics;
	size?: "sm" | "md" | "lg";
	showIcon?: boolean;
	showDetails?: boolean;
	loading?: boolean;
	onClick?: () => void;
	class?: string;
}

let {
	integration,
	syncStatus,
	integrationStatus,
	syncStats,
	size = "sm",
	showIcon = true,
	showDetails = false,
	loading = false,
	onClick,
	class: className = "",
}: Props = $props();

// Mobile performance optimizations
const capabilities = progressiveEnhancement.getCapabilities();
const shouldUseAnimations =
	progressiveEnhancement.shouldEnableFeature("animations");
const shouldUseHaptics = progressiveEnhancement.shouldEnableFeature("haptics");

// Determine the actual status with enhanced logic
const status = $derived(() => {
	// Use enhanced status if available
	if (integrationStatus) {
		return integrationStatus.status;
	}

	if (!integration) return "disconnected";
	if (!integration.syncEnabled) return "disabled";

	// Use provided syncStatus or derive from integration
	if (syncStatus) return syncStatus;

	// Enhanced status derivation based on lastSyncAt
	if (integration.lastSyncAt) {
		const lastSync = new Date(integration.lastSyncAt);
		const now = new Date();
		const timeDiff = now.getTime() - lastSync.getTime();
		const fiveMinutes = 5 * 60 * 1000;
		const oneHour = 60 * 60 * 1000;

		// If last sync was within 5 minutes, consider it synced
		if (timeDiff < fiveMinutes) return "synced";
		// If last sync was within 1 hour, consider it pending
		if (timeDiff < oneHour) return "pending";
		// Otherwise, might be an error state
		return "error";
	}

	return "pending";
});

// Enhanced status configuration using semantic color system
const statusConfig = {
	disconnected: {
		label: "Not Connected",
		description: "Connect your integration to sync tasks",
		bgColor: "var(--surface-muted)",
		textColor: "var(--muted-foreground)",
		borderColor: "var(--subtle-base)",
		icon: Database,
		clickable: false,
		pulse: false,
	},
	disabled: {
		label: "Disabled",
		description: "Sync is disabled. Tasks won't sync.",
		bgColor: "var(--surface-muted)",
		textColor: "var(--muted-foreground)",
		borderColor: "var(--subtle-base)",
		icon: X,
		clickable: false,
		pulse: false,
	},
	synced: {
		label: "Synced",
		description: "Tasks are syncing successfully",
		bgColor: "var(--success-alert-bg)",
		textColor: "var(--success-foreground)",
		borderColor: "var(--success-border)",
		icon: CheckCircle,
		clickable: true,
		pulse: false,
	},
	pending: {
		label: "Syncing",
		description: "Synchronizing tasks...",
		bgColor: "var(--warning-alert-bg)",
		textColor: "var(--warning-foreground)",
		borderColor: "var(--warning-border)",
		icon: Clock,
		clickable: true,
		pulse: shouldUseAnimations, // Respect reduced motion preference
	},
	conflict: {
		label: "Conflict",
		description: "Sync conflicts detected. Tap for details.",
		bgColor: "var(--warning-alert-bg)",
		textColor: "var(--warning-foreground)",
		borderColor: "var(--warning-border)",
		icon: Warning,
		clickable: true,
		pulse: false,
	},
	error: {
		label: "Error",
		description: "Sync failed. Tap for details.",
		bgColor: "var(--error-alert-bg)",
		textColor: "var(--error-foreground)",
		borderColor: "var(--error-border)",
		icon: ErrorIcon,
		clickable: true,
		pulse: false,
	},
};

const currentStatus = $derived(statusConfig[status()]);

// Responsive sizing with mobile-first approach
const sizeClasses = {
	sm: "text-xs px-2 py-1 min-h-[24px]",
	md: "text-sm px-2.5 py-1.5 min-h-[32px]",
	lg: "text-base px-3 py-2 min-h-[44px]", // 44px minimum touch target for mobile
};

const iconSizes = {
	sm: "w-3 h-3",
	md: "w-4 h-4",
	lg: "w-5 h-5",
};

// Format last sync time
const lastSyncText = $derived(() => {
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
const syncStatsText = $derived(() => {
	if (!syncStats) return null;

	const parts = [];
	if (syncStats.syncedTasks > 0) {
		parts.push(`${syncStats.syncedTasks} synced`);
	}
	if (syncStats.pendingTasks > 0) {
		parts.push(`${syncStats.pendingTasks} pending`);
	}
	if (syncStats.errorTasks > 0) {
		parts.push(`${syncStats.errorTasks} errors`);
	}

	return parts.length > 0 ? parts.join(", ") : null;
});

// Enhanced click handling with haptic feedback
function handleClick() {
	if (onClick && currentStatus.clickable && !loading) {
		// Provide haptic feedback based on status
		if (shouldUseHaptics) {
			switch (status()) {
				case "synced":
					hapticFeedback.light();
					break;
				case "error":
					hapticFeedback.error();
					break;
				case "pending":
					hapticFeedback.medium();
					break;
				default:
					hapticFeedback.light();
			}
		}

		onClick();
	}
}

// Touch gesture handling for mobile
function handleTouchGesture(_event: TouchEvent) {
	handleClick();
}

// Determine if badge should be clickable
const isClickable = $derived(currentStatus.clickable && onClick && !loading);
</script>

<!-- Enhanced Status Badge with mobile optimizations -->
{#if isClickable}
	<button
		onclick={handleClick}
		disabled={loading}
		class={cn(
			'inline-flex items-center gap-1.5 rounded-full border font-medium transition-all',
			'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
			'hover:opacity-80 active:scale-95 cursor-pointer',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			// Touch target optimization for mobile
			size === 'lg' && 'min-w-[44px]',
			// Touch optimizations
			capabilities.hasTouch && 'touch-manipulation select-none',
			// Conditional pulse animation based on reduced motion preference
			currentStatus.pulse && shouldUseAnimations && 'animate-pulse',
			// Performance optimization for low-end devices
			capabilities.isLowEndDevice ? 'duration-100' : 'duration-200',
			sizeClasses[size],
			className
		)}
		style={`
			background-color: ${currentStatus.bgColor};
			color: ${currentStatus.textColor};
			border-color: ${currentStatus.borderColor};
		`}
		aria-label={`${currentStatus.label} - ${currentStatus.description}`}
	>
		{#if showIcon}
			{@const IconComponent = currentStatus.icon}
			<IconComponent 
				class={cn(
					iconSizes[size],
					// Add spin animation for loading states (respecting reduced motion)
					(status() === 'pending' || loading) && IconComponent === Clock && shouldUseAnimations && 'animate-spin'
				)}
			/>
		{/if}
		
		<span class="whitespace-nowrap">{currentStatus.label}</span>
		
		<!-- Loading indicator overlay -->
		{#if loading}
			<Spinner class={cn(iconSizes[size], 'ml-1')} />
		{/if}
	</button>
{:else}
	<span
		class={cn(
			'inline-flex items-center gap-1.5 rounded-full border font-medium',
			// Conditional pulse animation based on reduced motion preference
			currentStatus.pulse && shouldUseAnimations && 'animate-pulse',
			sizeClasses[size],
			className
		)}
		style={`
			background-color: ${currentStatus.bgColor};
			color: ${currentStatus.textColor};
			border-color: ${currentStatus.borderColor};
		`}
		aria-label={currentStatus.description}
	>
		{#if showIcon}
			{@const IconComponent = currentStatus.icon}
			<IconComponent 
				class={cn(
					iconSizes[size],
					// Add spin animation for loading states (respecting reduced motion)
					(status() === 'pending' || loading) && IconComponent === Clock && shouldUseAnimations && 'animate-spin'
				)}
			/>
		{/if}
		
		<span class="whitespace-nowrap">{currentStatus.label}</span>
		
		<!-- Loading indicator overlay -->
		{#if loading}
			<Spinner class={cn(iconSizes[size], 'ml-1')} />
		{/if}
	</span>
{/if}

<!-- Enhanced details section when showDetails is true -->
{#if showDetails && (lastSyncText || syncStatsText || integrationStatus?.lastError)}
	<div class="mt-2 space-y-1">
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
			<p class="text-xs font-medium" style="color: var(--error-foreground)">
				{integrationStatus.lastError}
			</p>
		{/if}
		
		{#if syncStats && syncStats.lastSyncDuration}
			<p class="text-xs text-muted-foreground">
				Last sync took {syncStats.lastSyncDuration}ms
			</p>
		{/if}
	</div>
{/if}