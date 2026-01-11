/**
 * Database caching utility with TTL management
 * Provides efficient caching for Notion database lists and metadata
 */

import { integrationCache } from "./cache-manager";

export interface NotionDatabase {
	id: string;
	name: string;
	url?: string;
	icon?: {
		type: "emoji" | "external" | "file";
		emoji?: string;
		external?: { url: string };
		file?: { url: string };
	};
	properties?: Record<string, unknown>;
	created_time?: string;
	last_edited_time?: string;
}

export interface DatabaseCacheEntry {
	databases: NotionDatabase[];
	timestamp: number;
	workspaceId: string;
}

/**
 * Enhanced database cache manager
 */
export class DatabaseCacheManager {
	private loadingPromises = new Map<string, Promise<NotionDatabase[]>>();

	/**
	 * Get databases with caching and loading deduplication
	 */
	async getDatabases(
		workspaceId: string,
		forceRefresh = false,
	): Promise<NotionDatabase[]> {
		// Check cache first (unless force refresh)
		if (!forceRefresh) {
			const cached = integrationCache.getDatabases(workspaceId);
			if (cached) {
				return cached;
			}
		}

		// Check if already loading to prevent duplicate requests
		const loadingKey = `databases:${workspaceId}`;
		if (this.loadingPromises.has(loadingKey)) {
			return this.loadingPromises.get(loadingKey)!;
		}

		// Create loading promise
		const loadingPromise = this.fetchDatabases(workspaceId);
		this.loadingPromises.set(loadingKey, loadingPromise);

		try {
			const databases = await loadingPromise;

			// Cache the result
			integrationCache.setDatabases(workspaceId, databases);

			return databases;
		} finally {
			// Clean up loading promise
			this.loadingPromises.delete(loadingKey);
		}
	}

	/**
	 * Fetch databases from API
	 */
	private async fetchDatabases(
		_workspaceId: string,
	): Promise<NotionDatabase[]> {
		try {
			const response = await fetch("/api/integrations/notion/databases", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			return data.databases || [];
		} catch (error) {
			console.error("Failed to fetch databases:", error);
			throw error;
		}
	}

	/**
	 * Preload databases for a workspace
	 */
	async preloadDatabases(workspaceId: string): Promise<void> {
		try {
			await this.getDatabases(workspaceId);
		} catch (error) {
			// Silently fail for preloading
			console.warn("Failed to preload databases:", error);
		}
	}

	/**
	 * Invalidate database cache for workspace
	 */
	invalidateDatabases(workspaceId: string): void {
		integrationCache.invalidateDatabases(workspaceId);
	}

	/**
	 * Check if databases are cached
	 */
	hasCachedDatabases(workspaceId: string): boolean {
		return integrationCache.getDatabases(workspaceId) !== null;
	}

	/**
	 * Get database by ID from cache
	 */
	getDatabaseById(
		workspaceId: string,
		databaseId: string,
	): NotionDatabase | null {
		const databases = integrationCache.getDatabases(workspaceId);
		if (!databases) return null;

		return databases.find((db) => db.id === databaseId) || null;
	}

	/**
	 * Search databases by name
	 */
	searchDatabases(workspaceId: string, query: string): NotionDatabase[] {
		const databases = integrationCache.getDatabases(workspaceId);
		if (!databases) return [];

		const lowerQuery = query.toLowerCase();
		return databases.filter((db) => db.name.toLowerCase().includes(lowerQuery));
	}

	/**
	 * Get database metadata for display
	 */
	getDatabaseMetadata(database: NotionDatabase): {
		icon: { type: "emoji" | "default"; content?: string };
		createdDate?: string;
		propertyCount?: number;
	} {
		const metadata: any = {};

		// Handle icon
		if (database.icon?.type === "emoji" && database.icon.emoji) {
			metadata.icon = { type: "emoji", content: database.icon.emoji };
		} else {
			metadata.icon = { type: "default" };
		}

		// Handle created date
		if (database.created_time) {
			const date = new Date(database.created_time);
			metadata.createdDate = date.toLocaleDateString();
		}

		// Handle property count
		if (database.properties) {
			metadata.propertyCount = Object.keys(database.properties).length;
		}

		return metadata;
	}

	/**
	 * Format database for display
	 */
	formatDatabaseDisplay(database: NotionDatabase): string {
		const parts = [];

		const metadata = this.getDatabaseMetadata(database);

		if (metadata.createdDate) {
			parts.push(`Created ${metadata.createdDate}`);
		}

		if (metadata.propertyCount) {
			parts.push(`${metadata.propertyCount} properties`);
		}

		return parts.join(" • ");
	}

	/**
	 * Get loading state for workspace
	 */
	isLoading(workspaceId: string): boolean {
		return this.loadingPromises.has(`databases:${workspaceId}`);
	}

	/**
	 * Clear all loading promises
	 */
	clearLoading(): void {
		this.loadingPromises.clear();
	}
}

// Global database cache manager
export const databaseCache = new DatabaseCacheManager();

/**
 * Preload databases for common user actions
 */
export function preloadDatabasesForWorkspace(workspaceId: string): void {
	// Preload in background without blocking UI
	setTimeout(() => {
		databaseCache.preloadDatabases(workspaceId);
	}, 100);
}

/**
 * Utility function to get database icon for display
 */
export function getDatabaseIcon(database: NotionDatabase): {
	type: "emoji" | "default";
	content?: string;
} {
	return databaseCache.getDatabaseMetadata(database).icon;
}

/**
 * Utility function to format database metadata
 */
export function formatDatabaseMetadata(database: NotionDatabase): string {
	return databaseCache.formatDatabaseDisplay(database);
}
