/**
 * Unified Guest User Service
 * Consolidates guest registration, recovery, and persistence logic
 */

import type { Task, Workspace } from "@notion-task-manager/db";
import {
	guestUser,
	isGuestMode,
	updateGuestTaskCount,
} from "$lib/stores/guest";
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

export interface GuestRegistrationResult {
	success: boolean;
	guestId: string;
	workspace: Workspace;
	message: string;
}

export class GuestUserService {
	/**
	 * Register a new guest user and create default workspace
	 */
	async registerGuestUser(): Promise<GuestRegistrationResult> {
		try {
			const response = await fetch("/api/guest/register", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || "Failed to register guest user");
			}

			const guest = {
				id: result.data.guestId,
				workspace: result.data.workspace,
				isRegistered: true,
				taskCount: 0,
			};

			// Update stores
			guestUser.set(guest);
			isGuestMode.set(true);

			return {
				success: true,
				guestId: result.data.guestId,
				workspace: result.data.workspace,
				message: "Guest user registered successfully",
			};
		} catch (error) {
			console.error("Failed to register guest user:", error);
			throw error;
		}
	}

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
				this.saveGuestData({
					guestId: localData.guestId,
					workspaceId: localData.workspaceId,
					tasks: mergedTasks,
					lastSync: new Date().toISOString(),
					deviceFingerprint: localData.deviceFingerprint,
				});

				// Update stores
				this.updateGuestStore(serverRecovery.workspace, mergedTasks);

				return {
					success: true,
					workspace: serverRecovery.workspace,
					tasks: mergedTasks,
					recoveredFromLocal: true,
					message: "Session recovered successfully with local data merged",
				};
			}

			// Server recovery failed, use local data only
			console.log("Server recovery failed, using local data only");
			return {
				success: true,
				workspace: {
					id: localData.workspaceId,
					name: "My Tasks",
					userId: localData.guestId,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				tasks: localData.tasks,
				recoveredFromLocal: true,
				message: "Session recovered from local storage only",
			};
		}

		// Strategy 2: Create new guest session
		console.log("No local data found, creating new guest session...");
		try {
			const registration = await this.registerGuestUser();
			return {
				success: true,
				workspace: registration.workspace,
				tasks: [],
				recoveredFromLocal: false,
				message: "New guest session created",
			};
		} catch (error) {
			console.error("Failed to create new guest session:", error);
			return {
				success: false,
				workspace: null,
				tasks: [],
				recoveredFromLocal: false,
				message: "Failed to initialize guest session",
			};
		}
	}

	/**
	 * Attempt to recover guest session from server
	 */
	private async attemptServerRecovery(guestId: string): Promise<{
		success: boolean;
		workspace: Workspace;
		tasks: Task[];
	}> {
		try {
			// Try to fetch guest workspace
			const workspaceResponse = await fetch("/api/guest/workspace", {
				headers: {
					"x-guest-id": guestId,
				},
			});

			if (!workspaceResponse.ok) {
				return { success: false, workspace: null as any, tasks: [] };
			}

			const workspaceData = await workspaceResponse.json();
			const workspace = workspaceData.workspace;

			// Try to fetch guest tasks
			const tasksResponse = await fetch(
				`/api/tasks?workspaceId=${workspace.id}`,
				{
					headers: {
						"x-guest-id": guestId,
					},
				},
			);

			let tasks: Task[] = [];
			if (tasksResponse.ok) {
				const tasksData = await tasksResponse.json();
				tasks = tasksData.data?.items || [];
			}

			return {
				success: true,
				workspace,
				tasks,
			};
		} catch (error) {
			console.error("Server recovery failed:", error);
			return { success: false, workspace: null as any, tasks: [] };
		}
	}

	/**
	 * Save guest data to local storage
	 */
	saveGuestData(data: GuestBackupData): void {
		saveGuestDataLocally(data);
	}

	/**
	 * Update guest stores with workspace and tasks
	 */
	updateGuestStore(workspace: Workspace, tasks?: Task[]): void {
		isGuestMode.set(true);
		guestUser.set({
			id: "guest",
			workspace,
			isRegistered: false,
			taskCount: tasks?.length || 0,
		});

		if (tasks) {
			updateGuestTaskCount(tasks.length);
		}
	}

	/**
	 * Check if user is already a registered guest (has cookie)
	 */
	async getGuestTaskCount(): Promise<number> {
		try {
			const response = await fetch("/api/guest/task-count");
			if (response.ok) {
				const data = await response.json();
				return data.count || 0;
			}
		} catch (error) {
			console.error("Failed to get guest task count:", error);
		}
		return 0;
	}

	/**
	 * Migrate guest data to authenticated account
	 */
	async migrateGuestData(guestTasks: Task[]): Promise<boolean> {
		try {
			const response = await fetch("/api/guest/migrate", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					tasks: guestTasks,
				}),
			});

			if (response.ok) {
				// Clear guest data after successful migration
				localStorage.removeItem("guest-backup");
				isGuestMode.set(false);
				guestUser.set(null);
				return true;
			}
		} catch (error) {
			console.error("Failed to migrate guest data:", error);
		}
		return false;
	}
}

// Export singleton instance
export const guestUserService = new GuestUserService();
