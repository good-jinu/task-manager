/**
 * Unified Guest User Service
 * Consolidates guest registration, recovery, and persistence logic
 */

import type { Task, Workspace } from "@task-manager/db";
import { browser } from "$app/environment";
import {
	guestUser,
	isGuestMode,
	updateGuestTaskCount,
} from "$lib/stores/guest";
import {
	type GuestBackupData,
	loadGuestDataLocally,
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
			console.log("Found local guest data, using local data only");
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
	 * Get guest task count from local storage or return 0
	 */
	async getGuestTaskCount(): Promise<number> {
		try {
			// Since the API endpoint doesn't exist, get count from local storage
			const localData = loadGuestDataLocally();
			return localData?.tasks?.length || 0;
		} catch (error) {
			console.error("Failed to get guest task count:", error);
		}
		return 0;
	}

	/**
	 * Migrate guest data to authenticated account
	 */
	async migrateGuestData(guestTasks: Task[]): Promise<boolean> {
		if (!browser) {
			console.warn("Migration can only be performed in browser environment");
			return false;
		}

		try {
			// Get guest ID from localStorage or cookie
			const guestId =
				localStorage.getItem("taskflow_guest_id") ||
				document.cookie
					.split("; ")
					.find((row) => row.startsWith("guest-id="))
					?.split("=")[1];

			if (!guestId) {
				console.warn("No guest ID found for migration");
				return false;
			}

			const response = await fetch("/api/guest/migrate", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-guest-id": guestId,
				},
				body: JSON.stringify({
					tasks: guestTasks,
				}),
			});

			if (response.ok) {
				// Clear guest data after successful migration
				localStorage.removeItem("guest-backup");
				localStorage.removeItem("taskflow_guest_id");
				localStorage.removeItem("taskflow_guest_workspace");
				isGuestMode.set(false);
				guestUser.set(null);
				return true;
			} else {
				const errorData = await response.json();
				console.error("Migration failed:", errorData.error);
			}
		} catch (error) {
			console.error("Failed to migrate guest data:", error);
		}
		return false;
	}
}

// Export singleton instance
export const guestUserService = new GuestUserService();
