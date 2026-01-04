import { writable } from "svelte/store";
import { offlineStorage } from "./offline-storage.js";

// Online/offline state store
export const isOnline = writable(
	typeof navigator !== "undefined" ? navigator.onLine : true,
);

// Sync status store
export const syncStatus = writable<"idle" | "syncing" | "error">("idle");

class OfflineSyncService {
	private syncInProgress = false;

	constructor() {
		if (typeof window !== "undefined") {
			// Listen for online/offline events
			window.addEventListener("online", this.handleOnline.bind(this));
			window.addEventListener("offline", this.handleOffline.bind(this));

			// Initialize online state
			isOnline.set(navigator.onLine);
		}
	}

	private handleOnline(): void {
		isOnline.set(true);
		this.syncPendingOperations();
	}

	private handleOffline(): void {
		isOnline.set(false);
	}

	async syncPendingOperations(): Promise<void> {
		if (this.syncInProgress) return;

		this.syncInProgress = true;
		syncStatus.set("syncing");

		try {
			// Get all pending queue items
			const queueItems = await offlineStorage.getQueueItems();

			for (const item of queueItems) {
				try {
					await this.processQueueItem(item);
					await offlineStorage.removeFromQueue(item.id);
				} catch (error) {
					console.error("Failed to sync queue item:", error);
					await offlineStorage.incrementRetryCount(item.id);

					// Remove items that have failed too many times
					if (item.retryCount >= 3) {
						await offlineStorage.removeFromQueue(item.id);
					}
				}
			}

			// Sync pending tasks
			const pendingTasks = await offlineStorage.getPendingTasks();
			for (const task of pendingTasks) {
				try {
					await this.syncTask(task);
				} catch (error) {
					console.error("Failed to sync task:", error);
				}
			}

			syncStatus.set("idle");
		} catch (error) {
			console.error("Sync failed:", error);
			syncStatus.set("error");
		} finally {
			this.syncInProgress = false;
		}
	}

	private async processQueueItem(item: any): Promise<void> {
		const response = await fetch(item.endpoint, {
			method:
				item.operation === "create"
					? "POST"
					: item.operation === "update"
						? "PUT"
						: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
			body: item.data ? JSON.stringify(item.data) : undefined,
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
	}

	private async syncTask(task: any): Promise<void> {
		try {
			const response = await fetch(`/api/tasks/${task.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title: task.title,
					content: task.content,
					status: task.status,
					priority: task.priority,
					dueDate: task.dueDate,
				}),
			});

			if (response.ok) {
				await offlineStorage.markTaskAsSynced(task.id);
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		} catch (error) {
			console.error("Failed to sync task:", error);
			throw error;
		}
	}

	// Queue operations for offline execution
	async queueTaskOperation(
		operation: "create" | "update" | "delete",
		taskId: string,
		data?: any,
	): Promise<void> {
		const endpoint =
			operation === "create" ? "/api/tasks" : `/api/tasks/${taskId}`;

		await offlineStorage.addToQueue({
			operation,
			endpoint,
			data,
		});

		// If online, try to sync immediately
		if (navigator.onLine) {
			this.syncPendingOperations();
		}
	}

	// Optimistic task operations
	async createTaskOptimistic(taskData: any): Promise<string> {
		const taskId = crypto.randomUUID();
		const now = new Date().toISOString();

		const task = {
			id: taskId,
			...taskData,
			archived: false,
			createdAt: now,
			updatedAt: now,
			syncStatus: navigator.onLine ? "pending" : ("pending" as const),
		};

		// Save to local storage immediately
		await offlineStorage.saveTask(task);

		// Queue for server sync
		await this.queueTaskOperation("create", taskId, taskData);

		return taskId;
	}

	async updateTaskOptimistic(taskId: string, updates: any): Promise<void> {
		// Get current task from local storage
		const currentTask = await offlineStorage.getTask(taskId);
		if (!currentTask) return;

		// Apply updates optimistically
		const updatedTask = {
			...currentTask,
			...updates,
			updatedAt: new Date().toISOString(),
			syncStatus: "pending" as const,
		};

		// Save to local storage immediately
		await offlineStorage.saveTask(updatedTask);

		// Queue for server sync
		await this.queueTaskOperation("update", taskId, updates);
	}

	async deleteTaskOptimistic(taskId: string): Promise<void> {
		// Remove from local storage immediately
		await offlineStorage.deleteTask(taskId);

		// Queue for server sync
		await this.queueTaskOperation("delete", taskId);
	}
}

export const offlineSyncService = new OfflineSyncService();
