import type { ExternalIntegration } from "@notion-task-manager/db";
import {
	type IntegrationStatus,
	integrationCache,
	type SyncStatistics,
} from "./cache-manager";

// Re-export types for convenience
export type { IntegrationStatus, SyncStatistics };

export interface IntegrationStatusData {
	integration: ExternalIntegration;
	status: IntegrationStatus;
	stats: SyncStatistics;
}

export class IntegrationStatusManager {
	private pollingIntervals = new Map<string, number>();
	private subscribers = new Map<
		string,
		Set<(data: IntegrationStatusData) => void>
	>();

	// Polling configuration
	private readonly POLLING_INTERVAL = 5000; // 5 seconds

	constructor() {
		// Setup cache cleanup
		setInterval(() => integrationCache.cleanup(), 60000);
	}

	/**
	 * Get integration status with enhanced caching
	 */
	async getStatus(
		workspaceId: string,
		integrationId: string,
		forceRefresh = false,
	): Promise<IntegrationStatusData | null> {
		// Note: We don't use cache for getStatus since it returns IntegrationStatusData
		// and the cache only stores IntegrationStatus objects

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

			// Update cache with smart invalidation
			integrationCache.setStatus(integrationId, statusData.status);
			integrationCache.setStats(integrationId, statusData.stats);

			// Notify subscribers
			this.notifySubscribers(`${workspaceId}:${integrationId}`, statusData);

			return statusData;
		} catch (error) {
			console.error("Failed to fetch integration status:", error);
			return null;
		}
	}

	/**
	 * Get all integration statuses for a workspace with enhanced caching
	 */
	async getAllStatuses(
		workspaceId: string,
		forceRefresh = false,
	): Promise<IntegrationStatusData[]> {
		// Note: We don't use cache for getAllStatuses since it returns full IntegrationStatusData
		// and the cache only stores IntegrationStatus objects

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
			interface IntegrationStatusItem {
				integration: ExternalIntegration;
				status: {
					status: "disconnected" | "disabled" | "synced" | "pending" | "error";
					lastSyncAt?: string;
					lastError?: string;
					totalTasks: number;
					syncedTasks: number;
					pendingTasks: number;
					errorTasks: number;
					lastSyncDuration?: number;
				};
				stats: SyncStatistics;
			}

			const statusDataArray: IntegrationStatusData[] = data.integrations.map(
				(item: IntegrationStatusItem) => ({
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

			// Update cache with smart invalidation
			integrationCache.setWorkspaceStatus(
				workspaceId,
				statusDataArray.map((item) => item.status),
			);

			// Update individual integration caches
			for (const statusData of statusDataArray) {
				integrationCache.setStatus(
					statusData.integration.id,
					statusData.status,
				);
				integrationCache.setStats(statusData.integration.id, statusData.stats);

				// Notify subscribers
				this.notifySubscribers(
					`${workspaceId}:${statusData.integration.id}`,
					statusData,
				);
			}

			return statusDataArray;
		} catch (error) {
			console.error("Failed to fetch integration statuses:", error);
			return [];
		}
	}

	/**
	 * Trigger manual refresh for an integration with smart cache invalidation
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

			// Smart cache invalidation
			integrationCache.invalidateStatus(integrationId);
			integrationCache.invalidateStats(integrationId);

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
	 * Invalidate cache for specific integration or workspace using smart invalidation
	 */
	invalidateCache(integrationId?: string, workspaceId?: string): void {
		if (integrationId && workspaceId) {
			integrationCache.onIntegrationUpdate(integrationId, workspaceId);
		} else if (workspaceId) {
			integrationCache.invalidateStatus(undefined, workspaceId);
		} else if (integrationId) {
			integrationCache.invalidateStatus(integrationId);
			integrationCache.invalidateStats(integrationId);
		}
	}

	/**
	 * Handle sync completion with smart cache updates
	 */
	onSyncComplete(integrationId: string, workspaceId: string): void {
		integrationCache.onSyncComplete(integrationId, workspaceId);
	}

	/**
	 * Handle database changes with smart cache updates
	 */
	onDatabaseChange(workspaceId: string): void {
		integrationCache.onDatabaseChange(workspaceId);
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

		// Clear subscribers
		this.subscribers.clear();

		// Destroy integration cache
		integrationCache.destroy();
	}

	/**
	 * Get cache statistics for monitoring
	 */
	getCacheStats() {
		return integrationCache.getCombinedStats();
	}
}

// Global instance
export const integrationStatusManager = new IntegrationStatusManager();
