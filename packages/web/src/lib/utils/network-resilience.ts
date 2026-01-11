/**
 * Network resilience and retry logic for the Notion integration improvements
 * Provides offline detection, queue management, exponential backoff, and automatic retry
 */

import {
	createErrorFromTemplate,
	errorStateManager,
	type UIErrorState,
} from "./error-handling";

export type NetworkStatus = "online" | "offline" | "slow" | "unknown";
export type QueuedOperationType =
	| "sync"
	| "oauth"
	| "api_call"
	| "database_query";

/**
 * Queued operation interface for offline/retry management
 */
export interface QueuedOperation {
	id: string;
	type: QueuedOperationType;
	operation: () => Promise<unknown>;
	retryCount: number;
	maxRetries: number;
	lastAttempt?: Date;
	nextAttempt?: Date;
	context?: Record<string, unknown>;
	priority: number; // Higher number = higher priority
}

/**
 * Retry configuration for different operation types
 */
export interface RetryConfig {
	maxRetries: number;
	baseDelay: number; // milliseconds
	maxDelay: number; // milliseconds
	backoffMultiplier: number;
	jitter: boolean; // Add random jitter to prevent thundering herd
}

/**
 * Network resilience manager class
 */
export class NetworkResilienceManager {
	private networkStatus: NetworkStatus = "unknown";
	private operationQueue = new Map<string, QueuedOperation>();
	private retryTimer?: number;
	private statusListeners = new Set<(status: NetworkStatus) => void>();
	private queueListeners = new Set<(queue: QueuedOperation[]) => void>();

	// Default retry configurations for different operation types
	private retryConfigs: Record<QueuedOperationType, RetryConfig> = {
		sync: {
			maxRetries: 5,
			baseDelay: 1000,
			maxDelay: 300000, // 5 minutes
			backoffMultiplier: 2,
			jitter: true,
		},
		oauth: {
			maxRetries: 3,
			baseDelay: 2000,
			maxDelay: 60000, // 1 minute
			backoffMultiplier: 2,
			jitter: false,
		},
		api_call: {
			maxRetries: 3,
			baseDelay: 1000,
			maxDelay: 30000, // 30 seconds
			backoffMultiplier: 1.5,
			jitter: true,
		},
		database_query: {
			maxRetries: 4,
			baseDelay: 500,
			maxDelay: 60000, // 1 minute
			backoffMultiplier: 2,
			jitter: true,
		},
	};

	constructor() {
		this.initializeNetworkDetection();
		this.startRetryProcessor();
	}

	/**
	 * Initialize network status detection
	 */
	private initializeNetworkDetection(): void {
		if (typeof navigator === "undefined" || typeof window === "undefined") {
			return; // Server-side rendering
		}

		// Initial status
		this.updateNetworkStatus(navigator.onLine ? "online" : "offline");

		// Listen for network status changes
		window.addEventListener("online", () => {
			this.updateNetworkStatus("online");
			this.processQueuedOperations();
		});

		window.addEventListener("offline", () => {
			this.updateNetworkStatus("offline");
		});

		// Periodic connectivity check
		this.startConnectivityCheck();
	}

	/**
	 * Start periodic connectivity check to detect slow connections
	 */
	private startConnectivityCheck(): void {
		if (typeof window === "undefined") {
			// Skip connectivity check on server-side
			return;
		}

		setInterval(async () => {
			if (this.networkStatus === "offline") return;

			try {
				const start = Date.now();
				const response = await fetch("/api/health", {
					method: "HEAD",
					cache: "no-cache",
					signal: AbortSignal.timeout(5000), // 5 second timeout
				});

				const duration = Date.now() - start;

				if (response.ok) {
					// Classify connection speed
					if (duration > 3000) {
						this.updateNetworkStatus("slow");
					} else {
						this.updateNetworkStatus("online");
					}
				} else {
					this.updateNetworkStatus("offline");
				}
			} catch (error) {
				this.updateNetworkStatus("offline");
			}
		}, 30000); // Check every 30 seconds
	}

	/**
	 * Update network status and notify listeners
	 */
	private updateNetworkStatus(status: NetworkStatus): void {
		if (this.networkStatus !== status) {
			const previousStatus = this.networkStatus;
			this.networkStatus = status;
			this.notifyStatusListeners();

			// Add user notification for network changes
			if (status === "offline") {
				errorStateManager.addError(
					createErrorFromTemplate("network", "offline_mode", {
						networkStatus: status,
						previousStatus,
						timestamp: new Date(),
						queuedOperations: this.operationQueue.size,
					}),
				);
			} else if (status === "slow") {
				errorStateManager.addError(
					createErrorFromTemplate("network", "slow_connection", {
						networkStatus: status,
						previousStatus,
						timestamp: new Date(),
					}),
				);
			} else if (status === "online" && previousStatus === "offline") {
				// Clear network errors when back online and show recovery message
				errorStateManager.clearErrorsByType("network");

				// If there are queued operations, show a brief notification
				if (this.operationQueue.size > 0) {
					errorStateManager.addError({
						type: "network",
						severity: "info",
						message: `Connection restored. Processing ${this.operationQueue.size} queued operations.`,
						details:
							"Your queued requests are now being processed automatically.",
						actionable: false,
						retryable: false,
						context: {
							networkStatus: status,
							previousStatus,
							queuedOperations: this.operationQueue.size,
							timestamp: new Date(),
						},
					});
				}
			}
		}
	}

	/**
	 * Get current network status
	 */
	getNetworkStatus(): NetworkStatus {
		return this.networkStatus;
	}

	/**
	 * Subscribe to network status changes
	 */
	subscribeToNetworkStatus(
		listener: (status: NetworkStatus) => void,
	): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	/**
	 * Subscribe to queue changes
	 */
	subscribeToQueue(listener: (queue: QueuedOperation[]) => void): () => void {
		this.queueListeners.add(listener);
		return () => this.queueListeners.delete(listener);
	}

	/**
	 * Queue an operation for retry with exponential backoff
	 */
	queueOperation(
		type: QueuedOperationType,
		operation: () => Promise<unknown>,
		context?: Record<string, unknown>,
		priority: number = 0,
	): string {
		// Check queue size limits to prevent memory issues
		const maxQueueSize = 100;
		if (this.operationQueue.size >= maxQueueSize) {
			// Remove oldest low-priority operations to make room
			const operations = this.getQueuedOperations();
			const lowPriorityOps = operations
				.filter((op) => op.priority <= 0)
				.sort(
					(a, b) =>
						(a.lastAttempt?.getTime() || 0) - (b.lastAttempt?.getTime() || 0),
				);

			if (lowPriorityOps.length > 0) {
				this.operationQueue.delete(lowPriorityOps[0].id);
			} else {
				// Queue is full with high-priority operations
				errorStateManager.addError(
					createErrorFromTemplate("network", "queue_full", {
						queueSize: this.operationQueue.size,
						maxQueueSize,
						operationType: type,
						timestamp: new Date(),
					}),
				);
				throw new Error("Operation queue is full");
			}
		}

		const id = this.generateOperationId();
		const config = this.retryConfigs[type];

		const queuedOperation: QueuedOperation = {
			id,
			type,
			operation,
			retryCount: 0,
			maxRetries: config.maxRetries,
			context,
			priority,
		};

		this.operationQueue.set(id, queuedOperation);
		this.notifyQueueListeners();

		// Try to execute immediately if online
		if (this.networkStatus === "online") {
			this.executeOperation(id);
		}

		return id;
	}

	/**
	 * Remove an operation from the queue
	 */
	removeOperation(id: string): void {
		if (this.operationQueue.delete(id)) {
			this.notifyQueueListeners();
		}
	}

	/**
	 * Clear all queued operations
	 */
	clearQueue(): void {
		this.operationQueue.clear();
		this.notifyQueueListeners();
	}

	/**
	 * Get all queued operations
	 */
	getQueuedOperations(): QueuedOperation[] {
		return Array.from(this.operationQueue.values()).sort(
			(a, b) =>
				b.priority - a.priority ||
				(a.lastAttempt?.getTime() || 0) - (b.lastAttempt?.getTime() || 0),
		);
	}

	/**
	 * Execute a specific operation with retry logic
	 */
	private async executeOperation(id: string): Promise<void> {
		const queuedOp = this.operationQueue.get(id);
		if (!queuedOp) return;

		const config = this.retryConfigs[queuedOp.type];
		queuedOp.lastAttempt = new Date();

		try {
			await queuedOp.operation();

			// Success - remove from queue
			this.operationQueue.delete(id);
			this.notifyQueueListeners();
		} catch (error) {
			queuedOp.retryCount++;

			if (queuedOp.retryCount >= queuedOp.maxRetries) {
				// Max retries reached - remove from queue and log error
				this.operationQueue.delete(id);
				this.notifyQueueListeners();

				errorStateManager.addError({
					type: this.getErrorTypeForOperation(queuedOp.type),
					severity: "error",
					message: `Operation failed after ${queuedOp.maxRetries} retries`,
					details: error instanceof Error ? error.message : String(error),
					actionable: true,
					retryable: false,
					context: {
						...queuedOp.context,
						operationType: queuedOp.type,
						retryCount: queuedOp.retryCount,
					},
				});
			} else {
				// Schedule next retry
				const delay = this.calculateRetryDelay(queuedOp.retryCount, config);
				queuedOp.nextAttempt = new Date(Date.now() + delay);
				this.notifyQueueListeners();
			}
		}
	}

	/**
	 * Calculate retry delay with exponential backoff and jitter
	 */
	private calculateRetryDelay(retryCount: number, config: RetryConfig): number {
		let delay = Math.min(
			config.baseDelay * config.backoffMultiplier ** (retryCount - 1),
			config.maxDelay,
		);

		// Add jitter to prevent thundering herd
		if (config.jitter) {
			delay = delay * (0.5 + Math.random() * 0.5);
		}

		return Math.floor(delay);
	}

	/**
	 * Process all queued operations
	 */
	private async processQueuedOperations(): Promise<void> {
		if (this.networkStatus !== "online") return;

		const operations = this.getQueuedOperations();
		const now = new Date();

		for (const operation of operations) {
			// Skip if not ready for retry
			if (operation.nextAttempt && operation.nextAttempt > now) {
				continue;
			}

			// Execute operation
			await this.executeOperation(operation.id);
		}
	}

	/**
	 * Start the retry processor that runs periodically
	 */
	private startRetryProcessor(): void {
		if (typeof window === "undefined") {
			// Skip retry processor on server-side
			return;
		}

		this.retryTimer = window.setInterval(() => {
			this.processQueuedOperations();
		}, 5000); // Check every 5 seconds
	}

	/**
	 * Stop the retry processor
	 */
	stopRetryProcessor(): void {
		if (this.retryTimer && typeof window !== "undefined") {
			clearInterval(this.retryTimer);
			this.retryTimer = undefined;
		}
	}

	/**
	 * Get error type for operation type
	 */
	private getErrorTypeForOperation(
		operationType: QueuedOperationType,
	): "oauth" | "sync" | "network" | "database" {
		switch (operationType) {
			case "oauth":
				return "oauth";
			case "sync":
				return "sync";
			case "database_query":
				return "database";
			default:
				return "network";
		}
	}

	/**
	 * Generate unique operation ID
	 */
	private generateOperationId(): string {
		return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Notify status listeners
	 */
	private notifyStatusListeners(): void {
		this.statusListeners.forEach((listener) => {
			try {
				listener(this.networkStatus);
			} catch (error) {
				console.error("Error in network status listener:", error);
			}
		});
	}

	/**
	 * Notify queue listeners
	 */
	private notifyQueueListeners(): void {
		const queue = this.getQueuedOperations();
		this.queueListeners.forEach((listener) => {
			try {
				listener(queue);
			} catch (error) {
				console.error("Error in queue listener:", error);
			}
		});
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		this.stopRetryProcessor();
		this.statusListeners.clear();
		this.queueListeners.clear();
		this.operationQueue.clear();
	}
}

/**
 * Global network resilience manager instance (browser-only)
 */
export const networkResilienceManager =
	typeof window !== "undefined"
		? new NetworkResilienceManager()
		: (null as any as NetworkResilienceManager);

/**
 * Utility function to wrap API calls with retry logic
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	type: QueuedOperationType = "api_call",
	context?: Record<string, unknown>,
): Promise<T> {
	// On server-side, just execute the operation directly
	if (typeof window === "undefined" || !networkResilienceManager) {
		return await operation();
	}

	try {
		return await operation();
	} catch (error) {
		// If offline or error is retryable, queue the operation
		if (
			networkResilienceManager.getNetworkStatus() === "offline" ||
			isRetryableError(error)
		) {
			return new Promise((resolve, reject) => {
				const operationId = networkResilienceManager.queueOperation(
					type,
					async () => {
						try {
							const result = await operation();
							resolve(result);
							return result;
						} catch (retryError) {
							reject(retryError);
							throw retryError;
						}
					},
					context,
				);

				// Set a timeout to reject if operation takes too long
				setTimeout(() => {
					networkResilienceManager.removeOperation(operationId);
					reject(new Error("Operation timed out in retry queue"));
				}, 300000); // 5 minutes timeout
			});
		}

		// Non-retryable error, throw immediately
		throw error;
	}
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
	if (error instanceof Response) {
		// HTTP errors that are retryable
		return error.status >= 500 || error.status === 429 || error.status === 408;
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("network") ||
			message.includes("timeout") ||
			message.includes("connection") ||
			message.includes("fetch")
		);
	}

	return false;
}

/**
 * Enhanced fetch wrapper with automatic retry and offline support
 */
export async function resilientFetch(
	url: string,
	options?: RequestInit,
	retryType: QueuedOperationType = "api_call",
): Promise<Response> {
	return withRetry(
		async () => {
			const response = await fetch(url, options);

			if (!response.ok) {
				throw response;
			}

			return response;
		},
		retryType,
		{
			url,
			method: options?.method || "GET",
			timestamp: new Date(),
		},
	);
}

/**
 * Enhanced sync operation wrapper with specific retry logic for sync operations
 */
export async function resilientSyncOperation<T>(
	operation: () => Promise<T>,
	integrationId: string,
	syncType: "manual" | "automatic" = "automatic",
): Promise<T> {
	return withRetry(operation, "sync", {
		integrationId,
		syncType,
		timestamp: new Date(),
	});
}

/**
 * Enhanced OAuth operation wrapper with specific retry logic for OAuth flows
 */
export async function resilientOAuthOperation<T>(
	operation: () => Promise<T>,
	provider: string,
	workspaceId?: string,
): Promise<T> {
	return withRetry(operation, "oauth", {
		provider,
		workspaceId,
		timestamp: new Date(),
	});
}

/**
 * Network status indicator component data
 */
export interface NetworkStatusIndicator {
	status: NetworkStatus;
	message: string;
	color: string;
	icon: string;
	queuedOperations: number;
}

/**
 * Get network status indicator data for UI components
 */
export function getNetworkStatusIndicator(): NetworkStatusIndicator {
	// Default values for server-side rendering
	if (typeof window === "undefined" || !networkResilienceManager) {
		return {
			status: "unknown",
			message: "Checking connection...",
			color: "text-muted-foreground",
			icon: "⚪",
			queuedOperations: 0,
		};
	}

	const status = networkResilienceManager.getNetworkStatus();
	const queuedOperations =
		networkResilienceManager.getQueuedOperations().length;

	switch (status) {
		case "online":
			return {
				status,
				message:
					queuedOperations > 0
						? `Processing ${queuedOperations} queued operations`
						: "Connected",
				color: "text-success",
				icon: "🟢",
				queuedOperations,
			};
		case "slow":
			return {
				status,
				message: "Slow connection detected",
				color: "text-warning",
				icon: "🟡",
				queuedOperations,
			};
		case "offline":
			return {
				status,
				message:
					queuedOperations > 0
						? `${queuedOperations} operations queued`
						: "Offline",
				color: "text-error",
				icon: "🔴",
				queuedOperations,
			};
		default:
			return {
				status,
				message: "Checking connection...",
				color: "text-muted-foreground",
				icon: "⚪",
				queuedOperations,
			};
	}
}

/**
 * Cleanup function for when the app is unloaded
 */
if (typeof window !== "undefined" && networkResilienceManager) {
	window.addEventListener("beforeunload", () => {
		networkResilienceManager.destroy();
	});
}
