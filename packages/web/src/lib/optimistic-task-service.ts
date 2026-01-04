import { type Writable, writable } from "svelte/store";
import { offlineStorage } from "./offline-storage.js";
import { offlineSyncService } from "./offline-sync.js";

export interface Task {
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
	syncStatus?: "synced" | "pending" | "conflict";
}

export interface CreateTaskInput {
	workspaceId: string;
	title: string;
	content?: string;
	status?: Task["status"];
	priority?: Task["priority"];
	dueDate?: string;
}

export interface UpdateTaskInput {
	title?: string;
	content?: string;
	status?: Task["status"];
	priority?: Task["priority"];
	dueDate?: string;
}

class OptimisticTaskService {
	public tasks: Writable<Task[]> = writable([]);
	public loading: Writable<boolean> = writable(false);
	public error: Writable<string | null> = writable(null);

	async loadTasks(workspaceId: string): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			// First, load from offline storage for immediate display
			const offlineTasks = await offlineStorage.getTasks(workspaceId);
			this.tasks.set(offlineTasks);

			// Then try to fetch from server if online
			if (navigator.onLine) {
				try {
					const response = await fetch(`/api/tasks?workspaceId=${workspaceId}`);
					if (response.ok) {
						const serverTasks = await response.json();

						// Merge server tasks with offline tasks, preferring server data for synced tasks
						const mergedTasks = this.mergeTasks(
							serverTasks.tasks || [],
							offlineTasks,
						);
						this.tasks.set(mergedTasks);

						// Update offline storage with server data
						for (const task of serverTasks.tasks || []) {
							await offlineStorage.saveTask({
								...task,
								syncStatus: "synced",
								lastSyncAt: new Date().toISOString(),
							});
						}
					}
				} catch (error) {
					console.warn(
						"Failed to fetch tasks from server, using offline data:",
						error,
					);
				}
			}
		} catch (error) {
			console.error("Failed to load tasks:", error);
			this.error.set("Failed to load tasks");
		} finally {
			this.loading.set(false);
		}
	}

	private mergeTasks(serverTasks: Task[], offlineTasks: Task[]): Task[] {
		const taskMap = new Map<string, Task>();

		// Add offline tasks first
		for (const task of offlineTasks) {
			taskMap.set(task.id, task);
		}

		// Override with server tasks for synced items
		for (const task of serverTasks) {
			const offlineTask = taskMap.get(task.id);
			if (!offlineTask || offlineTask.syncStatus === "synced") {
				taskMap.set(task.id, {
					...task,
					syncStatus: "synced",
				});
			}
		}

		return Array.from(taskMap.values()).sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
	}

	async createTask(input: CreateTaskInput): Promise<string> {
		this.error.set(null);

		try {
			// Create task optimistically
			const taskId = await offlineSyncService.createTaskOptimistic(input);

			// Update local store immediately
			const newTask: Task = {
				id: taskId,
				...input,
				status: input.status || "todo",
				archived: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				syncStatus: "pending",
			};

			this.tasks.update((tasks) => [newTask, ...tasks]);

			return taskId;
		} catch (error) {
			console.error("Failed to create task:", error);
			this.error.set("Failed to create task");
			throw error;
		}
	}

	async updateTask(taskId: string, updates: UpdateTaskInput): Promise<void> {
		this.error.set(null);

		try {
			// Update optimistically
			await offlineSyncService.updateTaskOptimistic(taskId, updates);

			// Update local store immediately
			this.tasks.update((tasks) =>
				tasks.map((task) =>
					task.id === taskId
						? {
								...task,
								...updates,
								updatedAt: new Date().toISOString(),
								syncStatus: "pending" as const,
							}
						: task,
				),
			);
		} catch (error) {
			console.error("Failed to update task:", error);
			this.error.set("Failed to update task");
			throw error;
		}
	}

	async deleteTask(taskId: string): Promise<void> {
		this.error.set(null);

		try {
			// Delete optimistically
			await offlineSyncService.deleteTaskOptimistic(taskId);

			// Update local store immediately
			this.tasks.update((tasks) => tasks.filter((task) => task.id !== taskId));
		} catch (error) {
			console.error("Failed to delete task:", error);
			this.error.set("Failed to delete task");
			throw error;
		}
	}

	async toggleTaskStatus(taskId: string): Promise<void> {
		this.tasks.update((tasks) => {
			const task = tasks.find((t) => t.id === taskId);
			if (task) {
				const newStatus = task.status === "done" ? "todo" : "done";
				this.updateTask(taskId, { status: newStatus });
				return tasks.map((t) =>
					t.id === taskId
						? { ...t, status: newStatus, syncStatus: "pending" as const }
						: t,
				);
			}
			return tasks;
		});
	}

	// Rollback optimistic updates if sync fails
	async rollbackTask(taskId: string, originalTask?: Task): Promise<void> {
		if (originalTask) {
			this.tasks.update((tasks) =>
				tasks.map((task) => (task.id === taskId ? originalTask : task)),
			);
			await offlineStorage.saveTask({
				...originalTask,
				syncStatus: "conflict",
			});
		} else {
			// Remove task if it was a failed creation
			this.tasks.update((tasks) => tasks.filter((task) => task.id !== taskId));
			await offlineStorage.deleteTask(taskId);
		}
	}
}

export const optimisticTaskService = new OptimisticTaskService();
