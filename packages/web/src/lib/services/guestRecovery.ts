import type { Task, Workspace } from "@notion-task-manager/db";
import {
	type GuestBackupData,
	loadGuestDataLocally,
	mergeTasks,
	saveGuestDataLocally,
} from "$lib/stores/guestPersistence";

export interface GuestRecoveryResult {
	success: boolean;
	workspace: Workspace | null;
	tasks: Task[];
	recoveredFromLocal: boolean;
	message: string;
}

export class GuestRecoveryService {
	/**
	 * Attempt to recover guest session using multiple strategies
	 */
	async recoverGuestSession(): Promise<GuestRecoveryResult> {
		// Strategy 1: Try to load from local storage
		const localData = loadGuestDataLocally();
		if (localData) {
			console.log("Found local guest data, attempting server recovery...");

			// Try to restore the server session with the stored guest ID
			const serverRecovery = await this.attemptServerRecovery(
				localData.guestId,
			);
			if (serverRecovery.success) {
				// Merge local and server tasks
				const mergedTasks = mergeTasks(localData.tasks, serverRecovery.tasks);

				// Update local storage with merged data
				saveGuestDataLocally({
					guestId: localData.guestId,
					workspaceId: localData.workspaceId,
					tasks: mergedTasks,
				});

				return {
					success: true,
					workspace: serverRecovery.workspace,
					tasks: mergedTasks,
					recoveredFromLocal: true,
					message: "Session recovered successfully with local data merged",
				};
			}

			// Server recovery failed, but we have local data
			// Create a new server session and upload local tasks
			const newSessionResult =
				await this.createNewSessionWithLocalData(localData);
			if (newSessionResult.success) {
				return {
					...newSessionResult,
					recoveredFromLocal: true,
					message: "Created new session and restored your local tasks",
				};
			}
		}

		// Strategy 2: Create completely new guest session
		console.log("No recoverable data found, creating new guest session...");
		return await this.createFreshGuestSession();
	}

	/**
	 * Try to recover existing server session
	 */
	private async attemptServerRecovery(guestId: string): Promise<{
		success: boolean;
		workspace: Workspace | null;
		tasks: Task[];
	}> {
		try {
			// Try to restore session by setting the guest-id cookie and fetching data
			// Set cookie using a more standard approach
			const cookieValue = `guest-id=${guestId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
			if (typeof document !== "undefined") {
				// biome-ignore lint/suspicious/noDocumentCookie: Required for guest session recovery
				document.cookie = cookieValue;
			}

			const response = await fetch("/api/workspaces");
			const data = await response.json();

			if (response.ok && data.workspaces && data.workspaces.length > 0) {
				const workspace = data.workspaces[0];

				// Fetch tasks for this workspace
				const tasksResponse = await fetch(
					`/api/tasks?workspaceId=${workspace.id}`,
				);
				const tasksData = await tasksResponse.json();

				if (tasksResponse.ok) {
					return {
						success: true,
						workspace,
						tasks: tasksData.data?.items || [],
					};
				}
			}

			return { success: false, workspace: null, tasks: [] };
		} catch (error) {
			console.error("Server recovery failed:", error);
			return { success: false, workspace: null, tasks: [] };
		}
	}

	/**
	 * Create new server session and upload local tasks
	 */
	private async createNewSessionWithLocalData(
		localData: GuestBackupData,
	): Promise<GuestRecoveryResult> {
		try {
			// Register new guest user
			const response = await fetch("/api/guest/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const result = await response.json();

			if (response.ok && result.success) {
				const { workspace } = result;

				// Upload local tasks to new workspace
				const uploadedTasks = await this.uploadLocalTasks(
					workspace.id,
					localData.tasks,
				);

				// Update local storage with new IDs
				saveGuestDataLocally({
					guestId: result.guestId,
					workspaceId: workspace.id,
					tasks: uploadedTasks,
				});

				return {
					success: true,
					workspace,
					tasks: uploadedTasks,
					recoveredFromLocal: false,
					message: "Restored your tasks in a new session",
				};
			}

			return {
				success: false,
				workspace: null,
				tasks: [],
				recoveredFromLocal: false,
				message: "Failed to create new session",
			};
		} catch (error) {
			console.error("Failed to create new session with local data:", error);
			return {
				success: false,
				workspace: null,
				tasks: [],
				recoveredFromLocal: false,
				message: "Failed to restore session",
			};
		}
	}

	/**
	 * Upload local tasks to server workspace
	 */
	private async uploadLocalTasks(
		workspaceId: string,
		localTasks: Task[],
	): Promise<Task[]> {
		const uploadedTasks: Task[] = [];

		for (const task of localTasks) {
			try {
				const response = await fetch("/api/tasks", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						workspaceId,
						title: task.title,
						content: task.content,
						status: task.status,
						priority: task.priority,
						dueDate: task.dueDate,
					}),
				});

				const result = await response.json();
				if (response.ok && result.success) {
					uploadedTasks.push(result.data);
				} else {
					console.warn("Failed to upload task:", task.title);
				}
			} catch (error) {
				console.error("Error uploading task:", error);
			}
		}

		return uploadedTasks;
	}

	/**
	 * Create completely fresh guest session
	 */
	private async createFreshGuestSession(): Promise<GuestRecoveryResult> {
		try {
			const response = await fetch("/api/guest/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const result = await response.json();

			if (response.ok && result.success) {
				// Initialize local storage
				saveGuestDataLocally({
					guestId: result.guestId,
					workspaceId: result.workspace.id,
					tasks: [],
				});

				return {
					success: true,
					workspace: result.workspace,
					tasks: [],
					recoveredFromLocal: false,
					message: "New workspace created",
				};
			}

			return {
				success: false,
				workspace: null,
				tasks: [],
				recoveredFromLocal: false,
				message: "Failed to create workspace",
			};
		} catch (error) {
			console.error("Failed to create fresh guest session:", error);
			return {
				success: false,
				workspace: null,
				tasks: [],
				recoveredFromLocal: false,
				message: "Connection error",
			};
		}
	}
}
