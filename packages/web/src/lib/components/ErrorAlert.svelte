<script lang="ts">
import {
	createErrorFromTemplate,
	errorStateManager,
	handleApiError,
} from "../utils/error-handling";
import { Alert } from "./ui";

interface Props {
	error: string;
	/** Error type for better categorization */
	type?:
		| "oauth"
		| "network"
		| "permission"
		| "validation"
		| "sync"
		| "database"
		| "unknown";
	/** Whether to add this error to the global error state */
	trackError?: boolean;
	/** Additional context for error tracking */
	context?: Record<string, unknown>;
	/** Show retry action if error is retryable */
	showRetry?: boolean;
	/** Retry function to call when retry button is clicked */
	onRetry?: () => void | Promise<void>;
	/** Custom CSS classes */
	class?: string;
}

let {
	error,
	type = "unknown",
	trackError = false,
	context = {},
	showRetry = false,
	onRetry,
	class: className = "mb-6",
}: Props = $props();

// Track error in global state if requested
$effect(() => {
	if (error && trackError) {
		const errorTemplate = getErrorTemplate(type, error);
		errorStateManager.addError({
			...errorTemplate,
			context: { ...context, originalError: error },
		});
	}
});

function getErrorTemplate(errorType: string, message: string) {
	// Try to match the error message to known templates
	const messageLower = message.toLowerCase();

	if (errorType === "oauth") {
		if (messageLower.includes("access") && messageLower.includes("denied")) {
			return createErrorFromTemplate("oauth", "access_denied");
		}
		if (messageLower.includes("token") && messageLower.includes("expired")) {
			return createErrorFromTemplate("oauth", "token_expired");
		}
		if (
			messageLower.includes("network") ||
			messageLower.includes("connection")
		) {
			return createErrorFromTemplate("oauth", "network_error");
		}
	}

	if (errorType === "network") {
		if (messageLower.includes("timeout")) {
			return createErrorFromTemplate("network", "timeout");
		}
		if (messageLower.includes("connection")) {
			return createErrorFromTemplate("network", "connection_failed");
		}
	}

	// Default error template
	return {
		type: errorType as
			| "oauth"
			| "network"
			| "permission"
			| "validation"
			| "sync"
			| "database"
			| "unknown",
		severity: "error" as const,
		message,
		actionable: showRetry && !!onRetry,
		retryable: showRetry && !!onRetry,
	};
}

async function handleRetry() {
	if (onRetry) {
		try {
			await onRetry();
		} catch (retryError) {
			// Handle retry failure
			if (trackError) {
				handleApiError(retryError, { ...context, action: "retry" });
			}
		}
	}
}
</script>

{#if error}
	<Alert variant="error" class={className}>
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				{error}
			</div>
			{#if showRetry && onRetry}
				<button
					type="button"
					onclick={handleRetry}
					class="flex-shrink-0 px-3 py-1 text-xs font-medium bg-error-foreground text-error rounded hover:bg-error-foreground/90 transition-colors min-h-[32px]"
				>
					Retry
				</button>
			{/if}
		</div>
	</Alert>
{/if}