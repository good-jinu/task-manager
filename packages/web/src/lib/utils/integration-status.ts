import type { ExternalIntegration } from "@notion-task-manager/db";

export interface IntegrationStatus {
	status: "disconnected" | "disabled" | "synced" | "pending" | "error";
	lastSyncAt?: Date;
	lastError?: string;
	syncCount?: number;
	conflictCount?: number;
}

export interface SyncStatistics {
	totalTasks: number;
	syncedTasks: number;
	pendingTasks: number;
	errorTasks: number;
	lastSyncDuration?: number;
}

export interface IntegrationStatusData {
	integration: ExternalIntegration;
	status: IntegrationStatus;
	stats: SyncStatistics;
}

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

export class IntegrationStatusManager {
	private cache = new Map<string, CacheEntry<IntegrationStatusData>>();
	private pollingIntervals = new Map<string, number>();
	private subscribers = new Map<
		string,
		Set<(data: IntegrationStatusData) => void>
	>();

	// Cache TTL in milliseconds
	private readonly DEFAULT_TTL = 30000; // 30 seconds
	private readonly POLLING_INTERVAL = 5000; // 5 seconds

	constructor() {
		// Cleanup expired cache entries every minute
		setInterval(() => this.cleanup(), 60000);
	}

	/**
	 * Get integration status with caching
	 */
	async getStatus(
		workspaceId: string,
		integrationId: string,
		forceRefresh = false,
	): Promise<IntegrationStatusData | null> {
		const cacheKey = `${workspaceId}:${integrationId}`;

		// Check cache first (unless force refresh)
		if (!forceRefresh) {
			const cached = this.cache.get(cacheKey);
			if (cached && Date.now() - cached.timestamp < cached.ttl) {
				return cached.data;
			}
		}

		try {
			// Fetch from API
			const response = await fetch(
				`/api/integrations/status?workspaceId=${workspaceId}&integrationId=${integrationId}`,
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Convert lastSyncAt string to Date if present
			if (data.status?.lastSyncAt) {
				data.status.lastSyncAt = new Date(data.status.lastSyncAt);
			}

			const statusData: IntegrationStatusData = {
				integration: data.integration,
				status: data.status,
				stats: data.stats,
			};

			// Update cache
			this.cache.set(cacheKey, {
				data: statusData,
				timestamp: Date.now(),
				ttl: this.DEFAULT_TTL,
			});

			// Notify subscribers
			this.notifySubscribers(cacheKey, statusData);

			return statusData;
		} catch (error) {
			console.error("Failed to fetch integration status:", error);
			return null;
		}
	}

	/**
	 * Get all integration statuses for a workspace
	 */
	async getAllStatuses(
		workspaceId: string,
		forceRefresh = false,
	): Promise<IntegrationStatusData[]> {
		const cacheKey = `workspace:${workspaceId}`;

		// Check cache first (unless force refresh)
		if (!forceRefresh) {
			const cached = this.cache.get(cacheKey);
			if (cached && Date.now() - cached.timestamp < cached.ttl) {
				return Array.isArray(cached.data) ? cached.data : [cached.data];
			}
		}

		try {
			// Fetch from API
			const response = await fetch(
				`/api/integrations/status?workspaceId=${workspaceId}`,
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Process the integrations array
			const statusDataArray: IntegrationStatusData[] = data.integrations.map(
				(item: any) => ({
					integration: item.integration,
					status: {
						...item.status,
						lastSyncAt: item.status?.lastSyncAt
							? new Date(item.status.lastSyncAt)
							: undefined,
					},
					stats: item.stats,
				}),
			);

			// Update cache for workspace
			this.cache.set(cacheKey, {
				data: statusDataArray as any, // Type assertion to handle the array vs single item issue
				timestamp: Date.now(),
				ttl: this.DEFAULT_TTL,
			});

			// Update individual integration caches
			for (const statusData of statusDataArray) {
				const integrationCacheKey = `${workspaceId}:${statusData.integration.id}`;
				this.cache.set(integrationCacheKey, {
					data: statusData,
					timestamp: Date.now(),
					ttl: this.DEFAULT_TTL,
				});

				// Notify subscribers
				this.notifySubscribers(integrationCacheKey, statusData);
			}

			return statusDataArray;
		} catch (error) {
			console.error("Failed to fetch integration statuses:", error);
			return [];
		}
	}

	/**
	 * Trigger manual refresh for an integration
	 */
	async refreshStatus(integrationId: string): Promise<boolean> {
		try {
			const response = await fetch("/api/integrations/status", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					integrationId,
					action: "refresh",
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Invalidate cache to force refresh on next get
			this.invalidateCache(integrationId);

			return data.success;
		} catch (error) {
			console.error("Failed to refresh integration status:", error);
			return false;
		}
	}

	/**
	 * Start real-time polling for integration status updates
	 */
	startPolling(workspaceId: string, integrationId?: string): void {
		const key = integrationId
			? `${workspaceId}:${integrationId}`
			: `workspace:${workspaceId}`;

		// Clear existing interval if any
		this.stopPolling(workspaceId, integrationId);

		// Start new polling interval
		const intervalId = window.setInterval(async () => {
			if (integrationId) {
				await this.getStatus(workspaceId, integrationId, true);
			} else {
				await this.getAllStatuses(workspaceId, true);
			}
		}, this.POLLING_INTERVAL);

		this.pollingIntervals.set(key, intervalId);
	}

	/**
	 * Stop polling for integration status updates
	 */
	stopPolling(workspaceId: string, integrationId?: string): void {
		const key = integrationId
			? `${workspaceId}:${integrationId}`
			: `workspace:${workspaceId}`;
		const intervalId = this.pollingIntervals.get(key);

		if (intervalId) {
			window.clearInterval(intervalId);
			this.pollingIntervals.delete(key);
		}
	}

	/**
	 * Subscribe to status updates for an integration
	 */
	subscribe(
		workspaceId: string,
		integrationId: string,
		callback: (data: IntegrationStatusData) => void,
	): () => void {
		const key = `${workspaceId}:${integrationId}`;

		if (!this.subscribers.has(key)) {
			this.subscribers.set(key, new Set());
		}

		this.subscribers.get(key)?.add(callback);

		// Return unsubscribe function
		return () => {
			const subscribers = this.subscribers.get(key);
			if (subscribers) {
				subscribers.delete(callback);
				if (subscribers.size === 0) {
					this.subscribers.delete(key);
				}
			}
		};
	}

	/**
	 * Invalidate cache for specific integration or workspace
	 */
	invalidateCache(integrationId?: string, workspaceId?: string): void {
		if (integrationId && workspaceId) {
			this.cache.delete(`${workspaceId}:${integrationId}`);
		} else if (workspaceId) {
			// Invalidate all cache entries for this workspace
			for (const key of this.cache.keys()) {
				if (
					key.startsWith(`${workspaceId}:`) ||
					key === `workspace:${workspaceId}`
				) {
					this.cache.delete(key);
				}
			}
		} else if (integrationId) {
			// Invalidate all cache entries for this integration
			for (const key of this.cache.keys()) {
				if (key.endsWith(`:${integrationId}`)) {
					this.cache.delete(key);
				}
			}
		}
	}

	/**
	 * Clean up expired cache entries
	 */
	private cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > entry.ttl) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Notify subscribers of status updates
	 */
	private notifySubscribers(key: string, data: IntegrationStatusData): void {
		const subscribers = this.subscribers.get(key);
		if (subscribers) {
			subscribers.forEach((callback) => {
				try {
					callback(data);
				} catch (error) {
					console.error("Error in status update subscriber:", error);
				}
			});
		}
	}

	/**
	 * Destroy the manager and clean up resources
	 */
	destroy(): void {
		// Clear all polling intervals
		for (const intervalId of this.pollingIntervals.values()) {
			window.clearInterval(intervalId);
		}
		this.pollingIntervals.clear();

		// Clear cache and subscribers
		this.cache.clear();
		this.subscribers.clear();
	}
}

// Global instance
export const integrationStatusManager = new IntegrationStatusManager();
