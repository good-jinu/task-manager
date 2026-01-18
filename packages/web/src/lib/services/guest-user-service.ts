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
		console.log("[GuestUserService] Starting recoverGuestSession");

		// Strategy 1: Check if we have a guest cookie (server-side guest session)
		if (browser) {
			const guestCookie = document.cookie
				.split("; ")
				.find((row) => row.startsWith("guest-id="));

			console.log("[GuestUserService] Guest cookie check:", {
				found: !!guestCookie,
			});

			if (guestCookie) {
				const guestId = guestCookie.split("=")[1];
				console.log(
					"[GuestUserService] Found guest cookie, fetching workspace from server...",
					guestId,
				);

				try {
					// Fetch the guest's workspace from the server
					const response = await fetch("/api/workspaces");
					console.log("[GuestUserService] Workspaces fetch response:", {
						ok: response.ok,
						status: response.status,
					});

					if (response.ok) {
						const data = await response.json();
						const workspaces = data.workspaces || [];
						console.log(
							"[GuestUserService] Workspaces fetched:",
							workspaces.length,
						);

						if (workspaces.length > 0) {
							const workspace = workspaces[0];
							console.log(
								"[GuestUserService] Recovered guest workspace from server:",
								workspace.id,
							);

							// Fetch tasks for this workspace
							const tasksResponse = await fetch(
								`/api/tasks?workspaceId=${workspace.id}`,
							);
							const tasksData = await tasksResponse.json();
							const tasks = tasksData.items || [];
							console.log("[GuestUserService] Tasks fetched:", tasks.length);

							// Update local storage with correct data
							saveGuestDataLocally({
								guestId,
								workspaceId: workspace.id,
								tasks,
							});

							return {
								success: true,
								workspace,
								tasks,
								recoveredFromLocal: false,
								message: "Session recovered from server",
							};
						}
					}
				} catch (error) {
					console.error(
						"[GuestUserService] Failed to fetch guest workspace from server:",
						error,
					);
				}
			}
		}

		// Strategy 2: Try to load from local storage (fallback)
		console.log("[GuestUserService] Trying local storage fallback");
		const localData = loadGuestDataLocally();
		if (localData) {
			console.log(
				"[GuestUserService] Found local guest data, using as fallback",
			);
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
				message: "Session recovered from local storage",
			};
		}

		// Strategy 3: Create new guest session
		console.log(
			"[GuestUserService] No existing session found, creating new guest session...",
		);
		try {
			const registration = await this.registerGuestUser();
			console.log(
				"[GuestUserService] New guest registered:",
				registration.guestId,
			);
			return {
				success: true,
				workspace: registration.workspace,
				tasks: [],
				recoveredFromLocal: false,
				message: "New guest session created",
			};
		} catch (error) {
			console.error(
				"[GuestUserService] Failed to create new guest session:",
				error,
			);
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
}

// Export singleton instance
export const guestUserService = new GuestUserService();
