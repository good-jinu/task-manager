/**
 * Comprehensive error handling system for the Notion integration improvements
 * Provides error state management, recovery strategies, and user-friendly messaging
 */

export type ErrorSeverity = "info" | "warning" | "error" | "critical";
export type ErrorType =
	| "oauth"
	| "network"
	| "permission"
	| "validation"
	| "sync"
	| "database"
	| "unknown";

/**
 * Core error state interface with severity levels and recovery options
 */
export interface UIErrorState {
	id: string;
	type: ErrorType;
	severity: ErrorSeverity;
	message: string;
	details?: string;
	timestamp: Date;
	actionable: boolean;
	retryable: boolean;
	actions?: UIErrorAction[];
	context?: Record<string, unknown>;
}

/**
 * Error action interface for user-actionable error recovery
 */
export interface UIErrorAction {
	id: string;
	label: string;
	action: () => void | Promise<void>;
	primary?: boolean;
	destructive?: boolean;
	disabled?: boolean;
}

/**
 * Error recovery strategy interface with progressive escalation
 */
export interface ErrorRecoveryStrategy {
	immediate: () => Promise<boolean>;
	delayed: () => Promise<boolean>;
	manual: () => Promise<boolean>;
	escalation: () => void;
}

/**
 * Error logging interface for debugging and monitoring
 */
export interface ErrorLogEntry {
	id: string;
	timestamp: Date;
	error: UIErrorState;
	userAgent?: string;
	url?: string;
	userId?: string;
	workspaceId?: string;
	sessionId?: string;
	stackTrace?: string;
}

/**
 * Error state manager class for centralized error handling
 */
export class ErrorStateManager {
	private errors = new Map<string, UIErrorState>();
	private listeners = new Set<(errors: UIErrorState[]) => void>();
	private logEntries: ErrorLogEntry[] = [];
	private maxLogEntries = 100;

	/**
	 * Add a new error to the state
	 */
	addError(error: Omit<UIErrorState, "id" | "timestamp">): string {
		const id = this.generateErrorId();
		const fullError: UIErrorState = {
			...error,
			id,
			timestamp: new Date(),
		};

		this.errors.set(id, fullError);
		this.logError(fullError);
		this.notifyListeners();

		return id;
	}

	/**
	 * Remove an error from the state
	 */
	removeError(id: string): void {
		if (this.errors.delete(id)) {
			this.notifyListeners();
		}
	}

	/**
	 * Clear all errors
	 */
	clearErrors(): void {
		this.errors.clear();
		this.notifyListeners();
	}

	/**
	 * Clear errors by type
	 */
	clearErrorsByType(type: ErrorType): void {
		for (const [id, error] of this.errors.entries()) {
			if (error.type === type) {
				this.errors.delete(id);
			}
		}
		this.notifyListeners();
	}

	/**
	 * Get all current errors
	 */
	getErrors(): UIErrorState[] {
		return Array.from(this.errors.values()).sort(
			(a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
		);
	}

	/**
	 * Get errors by severity
	 */
	getErrorsBySeverity(severity: ErrorSeverity): UIErrorState[] {
		return this.getErrors().filter((error) => error.severity === severity);
	}

	/**
	 * Get errors by type
	 */
	getErrorsByType(type: ErrorType): UIErrorState[] {
		return this.getErrors().filter((error) => error.type === type);
	}

	/**
	 * Subscribe to error state changes
	 */
	subscribe(listener: (errors: UIErrorState[]) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Get error logs for debugging
	 */
	getErrorLogs(): ErrorLogEntry[] {
		return [...this.logEntries];
	}

	/**
	 * Export error logs for external monitoring
	 */
	exportErrorLogs(): string {
		return JSON.stringify(this.logEntries, null, 2);
	}

	private generateErrorId(): string {
		return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private logError(error: UIErrorState): void {
		const logEntry: ErrorLogEntry = {
			id: error.id,
			timestamp: error.timestamp,
			error,
			userAgent:
				typeof navigator !== "undefined" ? navigator.userAgent : undefined,
			url: typeof window !== "undefined" ? window.location.href : undefined,
			sessionId: this.getSessionId(),
		};

		this.logEntries.unshift(logEntry);

		// Keep only the most recent entries
		if (this.logEntries.length > this.maxLogEntries) {
			this.logEntries = this.logEntries.slice(0, this.maxLogEntries);
		}

		// Console logging for development
		if (typeof console !== "undefined") {
			const logMethod = this.getConsoleMethod(error.severity);
			logMethod(`[${error.type.toUpperCase()}] ${error.message}`, {
				details: error.details,
				context: error.context,
				timestamp: error.timestamp,
			});
		}
	}

	private getConsoleMethod(severity: ErrorSeverity): typeof console.log {
		switch (severity) {
			case "critical":
			case "error":
				return console.error;
			case "warning":
				return console.warn;
			default:
				return console.log;
		}
	}

	private getSessionId(): string {
		if (typeof sessionStorage === "undefined") return "unknown";

		let sessionId = sessionStorage.getItem("error_session_id");
		if (!sessionId) {
			sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			sessionStorage.setItem("error_session_id", sessionId);
		}
		return sessionId;
	}

	private notifyListeners(): void {
		const errors = this.getErrors();
		this.listeners.forEach((listener) => {
			try {
				listener(errors);
			} catch (error) {
				console.error("Error in error state listener:", error);
			}
		});
	}
}

/**
 * Global error state manager instance
 */
export const errorStateManager = new ErrorStateManager();

/**
 * Error message templates with user-friendly messaging
 */
export const errorMessages = {
	oauth: {
		access_denied: {
			message: "Please grant access to your Notion workspace to continue.",
			details:
				"The app needs permission to read and write your Notion database pages.",
			severity: "warning" as ErrorSeverity,
			retryable: true,
		},
		invalid_scope: {
			message: "The app needs permission to read and write database pages.",
			details:
				"Please ensure you grant all requested permissions during authorization.",
			severity: "error" as ErrorSeverity,
			retryable: true,
		},
		token_expired: {
			message: "Your Notion session has expired. Please reconnect.",
			details: "Your authorization token is no longer valid.",
			severity: "warning" as ErrorSeverity,
			retryable: true,
		},
		network_error: {
			message:
				"Unable to connect to Notion. Please check your internet connection.",
			details: "The authorization request failed due to network issues.",
			severity: "error" as ErrorSeverity,
			retryable: true,
		},
	},
	sync: {
		database_access_revoked: {
			message: "Access to your Notion database has been revoked.",
			details:
				"Please reconnect your Notion integration to restore sync functionality.",
			severity: "error" as ErrorSeverity,
			retryable: true,
		},
		sync_conflict: {
			message:
				"Task was modified in both systems. Please resolve the conflict.",
			details:
				"The task has been updated in both the app and Notion since the last sync.",
			severity: "warning" as ErrorSeverity,
			retryable: false,
		},
		rate_limited: {
			message: "Too many requests to Notion. Sync will resume automatically.",
			details: "The app is temporarily rate-limited by Notion's API.",
			severity: "info" as ErrorSeverity,
			retryable: true,
		},
		database_not_found: {
			message: "The connected Notion database could not be found.",
			details:
				"The database may have been deleted or access permissions changed.",
			severity: "error" as ErrorSeverity,
			retryable: false,
		},
	},
	network: {
		connection_failed: {
			message:
				"Unable to connect to the server. Please check your internet connection.",
			details: "The request failed due to network connectivity issues.",
			severity: "error" as ErrorSeverity,
			retryable: true,
		},
		timeout: {
			message: "The request timed out. Please try again.",
			details: "The server did not respond within the expected time.",
			severity: "warning" as ErrorSeverity,
			retryable: true,
		},
		server_error: {
			message: "A server error occurred. Please try again later.",
			details:
				"The server encountered an internal error while processing your request.",
			severity: "error" as ErrorSeverity,
			retryable: true,
		},
		offline_mode: {
			message:
				"You're currently offline. Operations will resume when connection is restored.",
			details:
				"Your requests are being queued and will be processed automatically when you're back online.",
			severity: "info" as ErrorSeverity,
			retryable: true,
		},
		slow_connection: {
			message:
				"Slow connection detected. Operations may take longer than usual.",
			details:
				"Your internet connection appears to be slow. Please be patient while requests complete.",
			severity: "warning" as ErrorSeverity,
			retryable: false,
		},
		queue_full: {
			message: "Too many operations are queued. Some requests may be dropped.",
			details:
				"The offline queue is full. Please wait for some operations to complete before trying again.",
			severity: "warning" as ErrorSeverity,
			retryable: true,
		},
	},
	validation: {
		invalid_input: {
			message: "Please check your input and try again.",
			details: "One or more fields contain invalid data.",
			severity: "warning" as ErrorSeverity,
			retryable: false,
		},
		missing_required_field: {
			message: "Please fill in all required fields.",
			details: "Some required information is missing.",
			severity: "warning" as ErrorSeverity,
			retryable: false,
		},
	},
	permission: {
		access_denied: {
			message: "You don't have permission to perform this action.",
			details:
				"Please contact your administrator or sign in with appropriate permissions.",
			severity: "error" as ErrorSeverity,
			retryable: false,
		},
		guest_restriction: {
			message: "This feature requires an account. Please sign up to continue.",
			details: "Guest users have limited access to integration features.",
			severity: "info" as ErrorSeverity,
			retryable: false,
		},
	},
} as const;

/**
 * Create a standardized error from a template
 */
export function createErrorFromTemplate(
	type: ErrorType,
	subtype: string,
	context?: Record<string, unknown>,
): Omit<UIErrorState, "id" | "timestamp"> {
	const errorType = errorMessages[type as keyof typeof errorMessages];

	if (!errorType) {
		return {
			type: "unknown",
			severity: "error",
			message: "An unexpected error occurred.",
			details: `Unknown error type: ${type}.${subtype}`,
			actionable: false,
			retryable: false,
			context,
		};
	}

	const template = errorType[subtype as keyof typeof errorType] as
		| {
				message: string;
				details: string;
				severity: ErrorSeverity;
				retryable: boolean;
		  }
		| undefined;

	if (!template) {
		return {
			type: "unknown",
			severity: "error",
			message: "An unexpected error occurred.",
			details: `Unknown error type: ${type}.${subtype}`,
			actionable: false,
			retryable: false,
			context,
		};
	}

	return {
		type,
		severity: template.severity,
		message: template.message,
		details: template.details,
		actionable: template.retryable,
		retryable: template.retryable,
		context,
	};
}

/**
 * Error recovery strategies with progressive escalation
 */
export const errorRecoveryStrategies: Record<string, ErrorRecoveryStrategy> = {
	"oauth.token_expired": {
		immediate: async () => {
			// Try to refresh tokens automatically
			try {
				const response = await fetch("/api/integrations/notion/oauth/refresh", {
					method: "POST",
				});
				return response.ok;
			} catch {
				return false;
			}
		},
		delayed: async () => {
			// Retry after a short delay
			await new Promise((resolve) => setTimeout(resolve, 2000));
			try {
				const response = await fetch("/api/integrations/notion/oauth/refresh", {
					method: "POST",
				});
				return response.ok;
			} catch {
				return false;
			}
		},
		manual: async () => {
			// Prompt user to manually reconnect
			return false; // Always requires manual intervention
		},
		escalation: () => {
			// Show reconnection dialog
			errorStateManager.addError(
				createErrorFromTemplate("oauth", "access_denied", {
					escalated: true,
					originalError: "token_expired",
				}),
			);
		},
	},
	"sync.database_access_revoked": {
		immediate: async () => false, // Cannot auto-recover from revoked access
		delayed: async () => false,
		manual: async () => false, // Requires user to re-authorize
		escalation: () => {
			// Show reconnection prompt
			errorStateManager.addError(
				createErrorFromTemplate("permission", "access_denied", {
					escalated: true,
					originalError: "database_access_revoked",
					action: "reconnect_notion",
				}),
			);
		},
	},
	"network.connection_failed": {
		immediate: async () => {
			// Check if network is back online
			if (typeof navigator !== "undefined" && "onLine" in navigator) {
				return navigator.onLine;
			}
			return false;
		},
		delayed: async () => {
			// Wait and retry
			await new Promise((resolve) => setTimeout(resolve, 5000));
			try {
				const response = await fetch("/api/health", { method: "HEAD" });
				return response.ok;
			} catch {
				return false;
			}
		},
		manual: async () => {
			// User-initiated retry
			return false; // Let user decide when to retry
		},
		escalation: () => {
			// Show offline mode or extended network error
			errorStateManager.addError(
				createErrorFromTemplate("network", "timeout", {
					escalated: true,
					originalError: "connection_failed",
				}),
			);
		},
	},
};

/**
 * Utility function to handle common API errors
 */
export function handleApiError(
	error: unknown,
	context?: Record<string, unknown>,
): string {
	if (error instanceof Response) {
		// Handle HTTP response errors
		const errorId = errorStateManager.addError({
			type: "network",
			severity: error.status >= 500 ? "error" : "warning",
			message: `Request failed with status ${error.status}`,
			details: error.statusText,
			actionable: error.status < 500,
			retryable: error.status >= 500 || error.status === 429,
			context: {
				...context,
				status: error.status,
				statusText: error.statusText,
			},
		});
		return errorId;
	}

	if (error instanceof Error) {
		// Handle JavaScript errors
		const errorId = errorStateManager.addError({
			type: "unknown",
			severity: "error",
			message: error.message,
			details: error.stack,
			actionable: false,
			retryable: false,
			context: { ...context, name: error.name },
		});
		return errorId;
	}

	// Handle unknown errors
	const errorId = errorStateManager.addError({
		type: "unknown",
		severity: "error",
		message: "An unexpected error occurred",
		details: String(error),
		actionable: false,
		retryable: false,
		context,
	});
	return errorId;
}
