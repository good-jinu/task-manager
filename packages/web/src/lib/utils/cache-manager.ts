/**
 * Enhanced cache manager with TTL management and smart invalidation
 * Provides efficient caching for database lists, integration status, and sync statistics
 */

// Type definitions for cached data
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

export interface IntegrationStatus {
	status: "connected" | "disconnected" | "syncing" | "error";
	lastSync?: string;
	nextSync?: string;
	syncEnabled?: boolean;
	error?: string;
}

export interface SyncStatistics {
	totalTasks: number;
	syncedTasks: number;
	failedTasks: number;
	lastSyncTime: string;
	syncDuration: number;
	errorCount: number;
}

export interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
	key: string;
}

export interface CacheConfig {
	defaultTTL: number;
	maxSize: number;
	cleanupInterval: number;
}

export interface CacheStats {
	hits: number;
	misses: number;
	size: number;
	hitRate: number;
}

/**
 * Generic cache manager with TTL and size limits
 */
export class CacheManager<T = unknown> {
	private cache = new Map<string, CacheEntry<T>>();
	private stats = { hits: 0, misses: 0 };
	private cleanupTimer: number | null = null;
	private config: CacheConfig;

	constructor(config: Partial<CacheConfig> = {}) {
		this.config = {
			defaultTTL: 300000, // 5 minutes
			maxSize: 100,
			cleanupInterval: 60000, // 1 minute
			...config,
		};

		this.startCleanupTimer();
	}

	/**
	 * Set cache entry with optional TTL
	 */
	set(key: string, data: T, ttl?: number): void {
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl: ttl || this.config.defaultTTL,
			key,
		};

		// Remove oldest entries if cache is full
		if (this.cache.size >= this.config.maxSize) {
			this.evictOldest();
		}

		this.cache.set(key, entry);
	}

	/**
	 * Get cache entry if valid
	 */
	get(key: string): T | null {
		const entry = this.cache.get(key);

		if (!entry) {
			this.stats.misses++;
			return null;
		}

		// Check if entry has expired
		if (Date.now() - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			this.stats.misses++;
			return null;
		}

		this.stats.hits++;
		return entry.data;
	}

	/**
	 * Check if key exists and is valid
	 */
	has(key: string): boolean {
		return this.get(key) !== null;
	}

	/**
	 * Invalidate specific key
	 */
	invalidate(key: string): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Invalidate keys matching pattern
	 */
	invalidatePattern(pattern: string | RegExp): number {
		let count = 0;
		const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

		for (const key of this.cache.keys()) {
			if (regex.test(key)) {
				this.cache.delete(key);
				count++;
			}
		}

		return count;
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
		this.stats = { hits: 0, misses: 0 };
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		const total = this.stats.hits + this.stats.misses;
		return {
			...this.stats,
			size: this.cache.size,
			hitRate: total > 0 ? this.stats.hits / total : 0,
		};
	}

	/**
	 * Get all cache keys
	 */
	getKeys(): string[] {
		return Array.from(this.cache.keys());
	}

	/**
	 * Get cache entry with metadata
	 */
	getEntry(key: string): CacheEntry<T> | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		// Check if expired
		if (Date.now() - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			return null;
		}

		return entry;
	}

	/**
	 * Update TTL for existing entry
	 */
	updateTTL(key: string, newTTL: number): boolean {
		const entry = this.cache.get(key);
		if (!entry) return false;

		entry.ttl = newTTL;
		entry.timestamp = Date.now(); // Reset timestamp
		return true;
	}

	/**
	 * Cleanup expired entries
	 */
	cleanup(): number {
		let removed = 0;
		const now = Date.now();

		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > entry.ttl) {
				this.cache.delete(key);
				removed++;
			}
		}

		return removed;
	}

	/**
	 * Evict oldest entries when cache is full
	 */
	private evictOldest(): void {
		let oldestKey: string | null = null;
		let oldestTime = Date.now();

		for (const [key, entry] of this.cache.entries()) {
			if (entry.timestamp < oldestTime) {
				oldestTime = entry.timestamp;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
		}
	}

	/**
	 * Start automatic cleanup timer
	 */
	private startCleanupTimer(): void {
		if (typeof window !== "undefined") {
			this.cleanupTimer = window.setInterval(() => {
				this.cleanup();
			}, this.config.cleanupInterval);
		}
	}

	/**
	 * Stop cleanup timer
	 */
	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.clear();
	}
}

/**
 * Specialized cache for integration data
 */
export class IntegrationCache {
	private databaseCache: CacheManager<NotionDatabase[]>;
	private statusCache: CacheManager<IntegrationStatus | IntegrationStatus[]>;
	private statsCache: CacheManager<SyncStatistics>;

	constructor() {
		// Different TTL for different types of data
		this.databaseCache = new CacheManager({
			defaultTTL: 300000, // 5 minutes - databases don't change often
			maxSize: 50,
		});

		this.statusCache = new CacheManager({
			defaultTTL: 30000, // 30 seconds - status changes frequently
			maxSize: 100,
		});

		this.statsCache = new CacheManager({
			defaultTTL: 60000, // 1 minute - stats update moderately
			maxSize: 100,
		});
	}

	// Database caching methods
	setDatabases(workspaceId: string, databases: NotionDatabase[]): void {
		this.databaseCache.set(`databases:${workspaceId}`, databases);
	}

	getDatabases(workspaceId: string): NotionDatabase[] | null {
		return this.databaseCache.get(`databases:${workspaceId}`);
	}

	invalidateDatabases(workspaceId?: string): void {
		if (workspaceId) {
			this.databaseCache.invalidate(`databases:${workspaceId}`);
		} else {
			this.databaseCache.invalidatePattern(/^databases:/);
		}
	}

	// Status caching methods
	setStatus(integrationId: string, status: IntegrationStatus): void {
		this.statusCache.set(`status:${integrationId}`, status);
	}

	getStatus(integrationId: string): IntegrationStatus | null {
		return this.statusCache.get(
			`status:${integrationId}`,
		) as IntegrationStatus | null;
	}

	setWorkspaceStatus(workspaceId: string, statuses: IntegrationStatus[]): void {
		this.statusCache.set(`workspace:${workspaceId}`, statuses);
	}

	getWorkspaceStatus(workspaceId: string): IntegrationStatus[] | null {
		return this.statusCache.get(`workspace:${workspaceId}`) as
			| IntegrationStatus[]
			| null;
	}

	invalidateStatus(integrationId?: string, workspaceId?: string): void {
		if (integrationId) {
			this.statusCache.invalidate(`status:${integrationId}`);
		}
		if (workspaceId) {
			this.statusCache.invalidate(`workspace:${workspaceId}`);
		}
		if (!integrationId && !workspaceId) {
			this.statusCache.clear();
		}
	}

	// Statistics caching methods
	setStats(integrationId: string, stats: SyncStatistics): void {
		this.statsCache.set(`stats:${integrationId}`, stats);
	}

	getStats(integrationId: string): SyncStatistics | null {
		return this.statsCache.get(`stats:${integrationId}`);
	}

	invalidateStats(integrationId?: string): void {
		if (integrationId) {
			this.statsCache.invalidate(`stats:${integrationId}`);
		} else {
			this.statsCache.clear();
		}
	}

	// Smart invalidation based on events
	onIntegrationUpdate(integrationId: string, workspaceId: string): void {
		// Invalidate related caches when integration changes
		this.invalidateStatus(integrationId, workspaceId);
		this.invalidateStats(integrationId);
		// Don't invalidate databases as they rarely change
	}

	onSyncComplete(integrationId: string, workspaceId: string): void {
		// Update status and stats after sync
		this.invalidateStatus(integrationId, workspaceId);
		this.invalidateStats(integrationId);
	}

	onDatabaseChange(workspaceId: string): void {
		// Invalidate database cache when databases change
		this.invalidateDatabases(workspaceId);
	}

	// Get combined cache statistics
	getCombinedStats(): {
		databases: CacheStats;
		status: CacheStats;
		stats: CacheStats;
		total: CacheStats;
	} {
		const dbStats = this.databaseCache.getStats();
		const statusStats = this.statusCache.getStats();
		const statsStats = this.statsCache.getStats();

		return {
			databases: dbStats,
			status: statusStats,
			stats: statsStats,
			total: {
				hits: dbStats.hits + statusStats.hits + statsStats.hits,
				misses: dbStats.misses + statusStats.misses + statsStats.misses,
				size: dbStats.size + statusStats.size + statsStats.size,
				hitRate: 0, // Will be calculated
			},
		};
	}

	// Cleanup all caches
	cleanup(): void {
		this.databaseCache.cleanup();
		this.statusCache.cleanup();
		this.statsCache.cleanup();
	}

	// Destroy all caches
	destroy(): void {
		this.databaseCache.destroy();
		this.statusCache.destroy();
		this.statsCache.destroy();
	}
}

// Global integration cache instance
export const integrationCache = new IntegrationCache();

// Cleanup on page unload
if (typeof window !== "undefined") {
	window.addEventListener("beforeunload", () => {
		integrationCache.destroy();
	});
}
