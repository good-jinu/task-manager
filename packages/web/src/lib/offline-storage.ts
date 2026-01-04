import { type DBSchema, type IDBPDatabase, openDB } from "idb";

interface OfflineDBSchema extends DBSchema {
	tasks: {
		key: string;
		value: {
			id: string;
			workspaceId: string;
			title: string;
			content?: string;
			status: "todo" | "in-progress" | "done" | "archived";
			priority?: "low" | "medium" | "high" | "urgent";
			dueDate?: string;
			archived: boolean;
			createdAt: string;
			updatedAt: string;
			// Offline-specific fields
			syncStatus: "synced" | "pending" | "conflict";
			lastSyncAt?: string;
		};
		indexes: {
			workspaceId: string;
			status: string;
			syncStatus: string;
		};
	};
	offlineQueue: {
		key: string;
		value: {
			id: string;
			operation: "create" | "update" | "delete";
			endpoint: string;
			data?: any;
			timestamp: number;
			retryCount: number;
		};
		indexes: {
			timestamp: number;
		};
	};
	workspaces: {
		key: string;
		value: {
			id: string;
			userId: string;
			name: string;
			description?: string;
			createdAt: string;
			updatedAt: string;
		};
	};
}

class OfflineStorage {
	private db: IDBPDatabase<OfflineDBSchema> | null = null;

	async init(): Promise<void> {
		this.db = await openDB<OfflineDBSchema>("TaskManagerOffline", 1, {
			upgrade(db) {
				// Tasks store
				const taskStore = db.createObjectStore("tasks", { keyPath: "id" });
				taskStore.createIndex("workspaceId", "workspaceId");
				taskStore.createIndex("status", "status");
				taskStore.createIndex("syncStatus", "syncStatus");

				// Offline queue store
				const queueStore = db.createObjectStore("offlineQueue", {
					keyPath: "id",
				});
				queueStore.createIndex("timestamp", "timestamp");

				// Workspaces store
				db.createObjectStore("workspaces", { keyPath: "id" });
			},
		});
	}

	// Task operations
	async saveTask(task: OfflineDBSchema["tasks"]["value"]): Promise<void> {
		if (!this.db) await this.init();
		await this.db!.put("tasks", task);
	}

	async getTask(
		id: string,
	): Promise<OfflineDBSchema["tasks"]["value"] | undefined> {
		if (!this.db) await this.init();
		return await this.db!.get("tasks", id);
	}

	async getTasks(
		workspaceId: string,
	): Promise<OfflineDBSchema["tasks"]["value"][]> {
		if (!this.db) await this.init();
		return await this.db!.getAllFromIndex("tasks", "workspaceId", workspaceId);
	}

	async deleteTask(id: string): Promise<void> {
		if (!this.db) await this.init();
		await this.db!.delete("tasks", id);
	}

	async getPendingTasks(): Promise<OfflineDBSchema["tasks"]["value"][]> {
		if (!this.db) await this.init();
		return await this.db!.getAllFromIndex("tasks", "syncStatus", "pending");
	}

	// Offline queue operations
	async addToQueue(
		operation: Omit<
			OfflineDBSchema["offlineQueue"]["value"],
			"id" | "timestamp" | "retryCount"
		>,
	): Promise<void> {
		if (!this.db) await this.init();
		const queueItem: OfflineDBSchema["offlineQueue"]["value"] = {
			...operation,
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			retryCount: 0,
		};
		await this.db!.put("offlineQueue", queueItem);
	}

	async getQueueItems(): Promise<OfflineDBSchema["offlineQueue"]["value"][]> {
		if (!this.db) await this.init();
		return await this.db!.getAll("offlineQueue");
	}

	async removeFromQueue(id: string): Promise<void> {
		if (!this.db) await this.init();
		await this.db!.delete("offlineQueue", id);
	}

	async incrementRetryCount(id: string): Promise<void> {
		if (!this.db) await this.init();
		const item = await this.db!.get("offlineQueue", id);
		if (item) {
			item.retryCount++;
			await this.db!.put("offlineQueue", item);
		}
	}

	// Workspace operations
	async saveWorkspace(
		workspace: OfflineDBSchema["workspaces"]["value"],
	): Promise<void> {
		if (!this.db) await this.init();
		await this.db!.put("workspaces", workspace);
	}

	async getWorkspaces(
		userId: string,
	): Promise<OfflineDBSchema["workspaces"]["value"][]> {
		if (!this.db) await this.init();
		const allWorkspaces = await this.db!.getAll("workspaces");
		return allWorkspaces.filter((w) => w.userId === userId);
	}

	// Sync operations
	async markTaskAsSynced(taskId: string): Promise<void> {
		if (!this.db) await this.init();
		const task = await this.db!.get("tasks", taskId);
		if (task) {
			task.syncStatus = "synced";
			task.lastSyncAt = new Date().toISOString();
			await this.db!.put("tasks", task);
		}
	}

	async markTaskAsPending(taskId: string): Promise<void> {
		if (!this.db) await this.init();
		const task = await this.db!.get("tasks", taskId);
		if (task) {
			task.syncStatus = "pending";
			await this.db!.put("tasks", task);
		}
	}

	// Clear all data (for logout/reset)
	async clearAll(): Promise<void> {
		if (!this.db) await this.init();
		await this.db!.clear("tasks");
		await this.db!.clear("offlineQueue");
		await this.db!.clear("workspaces");
	}
}

export const offlineStorage = new OfflineStorage();
