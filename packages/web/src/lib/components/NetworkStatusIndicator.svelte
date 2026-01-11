<script lang="ts">
/**
 * Network status indicator component for showing connection status and queued operations
 * Integrates with the network resilience system to provide real-time status updates
 */

import { onDestroy, onMount } from "svelte";
import {
	getNetworkStatusIndicator,
	type NetworkStatus,
	networkResilienceManager,
	type QueuedOperation,
} from "../utils/network-resilience";

interface Props {
	/** Show detailed status information */
	detailed?: boolean;
	/** Show queued operations count */
	showQueue?: boolean;
	/** Compact display mode */
	compact?: boolean;
	/** Custom CSS classes */
	class?: string;
}

let {
	detailed = false,
	showQueue = true,
	compact = false,
	class: className = "",
}: Props = $props();

let networkStatus: NetworkStatus = $state("unknown");
let queuedOperations: QueuedOperation[] = $state([]);
let unsubscribeStatus: (() => void) | undefined;
let unsubscribeQueue: (() => void) | undefined;

onMount(() => {
	// Only subscribe if we're in the browser and have a manager
	if (typeof window === "undefined" || !networkResilienceManager) {
		return;
	}

	// Subscribe to network status changes
	unsubscribeStatus = networkResilienceManager.subscribeToNetworkStatus(
		(status) => {
			networkStatus = status;
		},
	);

	// Subscribe to queue changes if needed
	if (showQueue) {
		unsubscribeQueue = networkResilienceManager.subscribeToQueue((queue) => {
			queuedOperations = queue;
		});
	}

	// Initial load
	networkStatus = networkResilienceManager.getNetworkStatus();
	if (showQueue) {
		queuedOperations = networkResilienceManager.getQueuedOperations();
	}
});

onDestroy(() => {
	unsubscribeStatus?.();
	unsubscribeQueue?.();
});

let statusIndicator = $derived(getNetworkStatusIndicator());

function getStatusColor(status: NetworkStatus): string {
	switch (status) {
		case "online":
			return "text-success";
		case "slow":
			return "text-warning";
		case "offline":
			return "text-error";
		default:
			return "text-muted-foreground";
	}
}

function getStatusBgColor(status: NetworkStatus): string {
	switch (status) {
		case "online":
			return "bg-success/10 border-success/20";
		case "slow":
			return "bg-warning/10 border-warning/20";
		case "offline":
			return "bg-error/10 border-error/20";
		default:
			return "bg-surface-muted border-subtle-base";
	}
}

function retryQueuedOperations(): void {
	// Only retry if we're in the browser and have a manager
	if (typeof window === "undefined" || !networkResilienceManager) {
		return;
	}

	// This will trigger a retry of all queued operations
	networkResilienceManager.getQueuedOperations().forEach((op) => {
		// Reset next attempt time to trigger immediate retry
		op.nextAttempt = new Date();
	});
}

function clearQueue(): void {
	// Only clear if we're in the browser and have a manager
	if (typeof window === "undefined" || !networkResilienceManager) {
		return;
	}

	networkResilienceManager.clearQueue();
}

function formatOperationType(type: string): string {
	return type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
</script>

<div class={`network-status-indicator ${className}`}>
	{#if compact}
		<!-- Compact Mode -->
		<div class={`
			inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs
			${getStatusBgColor(networkStatus)}
		`}>
			<span class="text-sm">{statusIndicator.icon}</span>
			{#if showQueue && queuedOperations.length > 0}
				<span class={getStatusColor(networkStatus)}>
					{queuedOperations.length}
				</span>
			{/if}
		</div>
	{:else}
		<!-- Full Mode -->
		<div class={`
			flex items-center justify-between p-3 rounded-lg border
			${getStatusBgColor(networkStatus)}
		`}>
			<div class="flex items-center gap-3">
				<span class="text-lg">{statusIndicator.icon}</span>
				<div class="flex-1">
					<div class={`font-medium text-sm ${getStatusColor(networkStatus)}`}>
						{statusIndicator.message}
					</div>
					{#if detailed && networkStatus === 'slow'}
						<div class="text-xs text-muted-foreground mt-1">
							Operations may take longer than usual
						</div>
					{/if}
				</div>
			</div>

			{#if showQueue && queuedOperations.length > 0}
				<div class="flex items-center gap-2">
					<div class="text-right">
						<div class="text-xs text-muted-foreground">
							{queuedOperations.length} queued
						</div>
						{#if detailed}
							<div class="text-xs text-muted-foreground">
								{queuedOperations.filter(op => op.retryCount > 0).length} retrying
							</div>
						{/if}
					</div>
					
					{#if networkStatus === 'offline'}
						<button
							type="button"
							onclick={retryQueuedOperations}
							class="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors min-h-[32px]"
							title="Retry queued operations"
						>
							Retry
						</button>
					{/if}
					
					<button
						type="button"
						onclick={clearQueue}
						class="px-2 py-1 text-xs bg-surface-muted text-foreground rounded hover:bg-surface-muted/80 transition-colors min-h-[32px]"
						title="Clear queue"
					>
						Clear
					</button>
				</div>
			{/if}
		</div>

		<!-- Detailed Queue Information -->
		{#if detailed && showQueue && queuedOperations.length > 0}
			<div class="mt-2 p-2 bg-surface-muted rounded border">
				<div class="text-xs font-medium text-muted-foreground mb-2">
					Queued Operations
				</div>
				<div class="space-y-1">
					{#each queuedOperations.slice(0, 3) as operation}
						<div class="flex items-center justify-between text-xs">
							<span class="text-foreground">
								{formatOperationType(operation.type)}
							</span>
							<div class="flex items-center gap-2 text-muted-foreground">
								{#if operation.retryCount > 0}
									<span>Retry {operation.retryCount}/{operation.maxRetries}</span>
								{/if}
								{#if operation.nextAttempt}
									<span>
										Next: {new Date(operation.nextAttempt).toLocaleTimeString()}
									</span>
								{/if}
							</div>
						</div>
					{/each}
					{#if queuedOperations.length > 3}
						<div class="text-xs text-muted-foreground text-center pt-1">
							+{queuedOperations.length - 3} more operations
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
.network-status-indicator {
	/* Ensure proper spacing and layout */
	display: flex;
	flex-direction: column;
}

/* Mobile optimizations */
@media (max-width: 768px) {
	.network-status-indicator button {
		/* Ensure minimum touch target size */
		min-height: 44px;
		min-width: 44px;
	}
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
	.network-status-indicator * {
		transition: none !important;
	}
}
</style>