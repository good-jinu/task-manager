<script lang="ts">
/**
 * Enhanced error display component that integrates with the comprehensive error handling system
 * Provides user-friendly error messages with actionable solutions and recovery options
 */

import { onDestroy, onMount } from "svelte";
import {
	createErrorActions,
	type ErrorSeverity,
	errorStateManager,
	type UIErrorAction,
	type UIErrorState,
} from "../utils/error-handling";
import {
	getNetworkStatusIndicator,
	networkResilienceManager,
} from "../utils/network-resilience";
import { Alert } from "./ui";

interface Props {
	/** Show only errors of specific types */
	filterTypes?: string[];
	/** Show only errors of specific severities */
	filterSeverities?: ErrorSeverity[];
	/** Maximum number of errors to display */
	maxErrors?: number;
	/** Show network status indicator */
	showNetworkStatus?: boolean;
	/** Compact display mode */
	compact?: boolean;
	/** Custom CSS classes */
	class?: string;
}

let {
	filterTypes = [],
	filterSeverities = [],
	maxErrors = 5,
	showNetworkStatus = false,
	compact = false,
	class: className = "",
}: Props = $props();

let errors = $state<UIErrorState[]>([]);
let networkStatus = $state(getNetworkStatusIndicator());
let unsubscribeErrors: (() => void) | undefined;
let unsubscribeNetwork: (() => void) | undefined;

onMount(() => {
	// Subscribe to error state changes
	unsubscribeErrors = errorStateManager.subscribe((newErrors) => {
		errors = filterErrors(newErrors);
	});

	// Subscribe to network status changes if enabled
	if (showNetworkStatus) {
		unsubscribeNetwork = networkResilienceManager.subscribeToNetworkStatus(
			() => {
				networkStatus = getNetworkStatusIndicator();
			},
		);
	}

	// Initial load
	errors = filterErrors(errorStateManager.getErrors());
});

onDestroy(() => {
	unsubscribeErrors?.();
	unsubscribeNetwork?.();
});

function filterErrors(allErrors: UIErrorState[]): UIErrorState[] {
	let filtered = allErrors;

	// Filter by types if specified
	if (filterTypes.length > 0) {
		filtered = filtered.filter((error) => filterTypes.includes(error.type));
	}

	// Filter by severities if specified
	if (filterSeverities.length > 0) {
		filtered = filtered.filter((error) =>
			filterSeverities.includes(error.severity),
		);
	}

	// Limit number of errors
	return filtered.slice(0, maxErrors);
}

function getAlertVariant(
	severity: ErrorSeverity,
): "info" | "warning" | "error" {
	switch (severity) {
		case "critical":
		case "error":
			return "error";
		case "warning":
			return "warning";
		default:
			return "info";
	}
}

function getSeverityIcon(severity: ErrorSeverity): string {
	switch (severity) {
		case "critical":
			return "🚨";
		case "error":
			return "❌";
		case "warning":
			return "⚠️";
		default:
			return "ℹ️";
	}
}

function getErrorActions(error: UIErrorState): UIErrorAction[] {
	// Use existing actions if available, otherwise create default ones
	if (error.actions && error.actions.length > 0) {
		return error.actions;
	}

	return createErrorActions(error.type, {
		...error.context,
		errorId: error.id,
	});
}

async function executeAction(action: UIErrorAction): Promise<void> {
	try {
		await action.action();
	} catch (error) {
		console.error("Error executing action:", error);
		errorStateManager.addError({
			type: "unknown",
			severity: "error",
			message: "Failed to execute error recovery action",
			details: error instanceof Error ? error.message : String(error),
			actionable: false,
			retryable: false,
			context: { actionId: action.id },
		});
	}
}

function dismissError(errorId: string): void {
	errorStateManager.removeError(errorId);
}

function formatTimestamp(timestamp: Date): string {
	const now = new Date();
	const diff = now.getTime() - timestamp.getTime();

	if (diff < 60000) {
		// Less than 1 minute
		return "Just now";
	} else if (diff < 3600000) {
		// Less than 1 hour
		const minutes = Math.floor(diff / 60000);
		return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
	} else if (diff < 86400000) {
		// Less than 1 day
		const hours = Math.floor(diff / 3600000);
		return `${hours} hour${hours > 1 ? "s" : ""} ago`;
	} else {
		return timestamp.toLocaleDateString();
	}
}
</script>

<div class={`error-state-display ${className}`}>
	<!-- Network Status Indicator -->
	{#if showNetworkStatus && networkStatus.status !== 'online'}
		<Alert variant={networkStatus.status === 'offline' ? 'error' : 'warning'} class="mb-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="text-lg">{networkStatus.icon}</span>
					<div>
						<div class="font-medium">{networkStatus.message}</div>
						{#if networkStatus.queuedOperations > 0}
							<div class="text-sm opacity-75">
								{networkStatus.queuedOperations} operations will retry when connection is restored
							</div>
						{/if}
					</div>
				</div>
			</div>
		</Alert>
	{/if}

	<!-- Error Messages -->
	{#each errors as error (error.id)}
		<Alert variant={getAlertVariant(error.severity)} class="mb-4">
			<div class="flex items-start justify-between gap-4">
				<div class="flex-1 min-w-0">
					<!-- Error Header -->
					<div class="flex items-center gap-2 mb-2">
						<span class="text-lg flex-shrink-0">{getSeverityIcon(error.severity)}</span>
						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm">
								{error.message}
							</div>
							{#if !compact}
								<div class="text-xs opacity-75 mt-1">
									{formatTimestamp(error.timestamp)}
								</div>
							{/if}
						</div>
					</div>

					<!-- Error Details -->
					{#if error.details && !compact}
						<div class="text-sm opacity-75 mb-3 pl-7">
							{error.details}
						</div>
					{/if}

					<!-- Error Actions -->
					{#if error.actionable}
						{@const actions = getErrorActions(error)}
						{#if actions.length > 0}
							<div class="flex flex-wrap gap-2 pl-7">
								{#each actions as action}
									<button
										type="button"
										onclick={() => executeAction(action)}
										disabled={action.disabled}
										class={`
											px-3 py-1 text-xs font-medium rounded-md transition-colors
											min-h-[32px] min-w-[32px]
											${action.primary 
												? 'bg-primary text-primary-foreground hover:bg-primary/90' 
												: action.destructive
													? 'bg-error text-error-foreground hover:bg-error/90'
													: 'bg-surface-muted text-foreground hover:bg-surface-muted/80'
											}
											${action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
										`}
									>
										{action.label}
									</button>
								{/each}
							</div>
						{/if}
					{/if}
				</div>

				<!-- Dismiss Button -->
				<button
					type="button"
					onclick={() => dismissError(error.id)}
					class="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
					title="Dismiss error"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</Alert>
	{/each}

	<!-- No Errors State -->
	{#if errors.length === 0 && !showNetworkStatus}
		<div class="text-center py-8 text-muted-foreground">
			<div class="text-2xl mb-2">✅</div>
			<div class="text-sm">No errors to display</div>
		</div>
	{/if}
</div>

<style>
.error-state-display {
	/* Ensure proper spacing and layout */
	display: flex;
	flex-direction: column;
}

/* Mobile optimizations */
@media (max-width: 768px) {
	.error-state-display :global(.alert) {
		/* Ensure touch-friendly buttons on mobile */
		font-size: 0.875rem;
	}
	
	.error-state-display button {
		/* Ensure minimum touch target size */
		min-height: 44px;
		min-width: 44px;
	}
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
	.error-state-display * {
		transition: none !important;
		animation: none !important;
	}
}
</style>