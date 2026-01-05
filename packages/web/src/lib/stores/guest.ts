import type { Workspace } from "@notion-task-manager/db";
import { get, writable } from "svelte/store";

export interface GuestUser {
	id: string;
	workspace: Workspace;
	isRegistered: boolean;
	taskCount?: number;
}

export const guestUser = writable<GuestUser | null>(null);
export const isGuestMode = writable<boolean>(false);

/**
 * Register a new guest user and create default workspace
 */
export async function registerGuestUser(): Promise<GuestUser> {
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

		const guest: GuestUser = {
			id: result.data.guestId,
			workspace: result.data.workspace,
			isRegistered: true,
			taskCount: 0,
		};

		guestUser.set(guest);
		isGuestMode.set(true);

		return guest;
	} catch (error) {
		console.error("Failed to register guest user:", error);
		throw error;
	}
}

/**
 * Check if user is already a registered guest (has cookie)
 */
export function checkExistingGuest(): boolean {
	// Check if guest-id cookie exists
	const cookies = document.cookie.split(";");
	const guestCookie = cookies.find((cookie) =>
		cookie.trim().startsWith("guest-id="),
	);

	if (guestCookie) {
		const guestId = guestCookie.split("=")[1];
		if (guestId && guestId.startsWith("guest_")) {
			isGuestMode.set(true);
			return true;
		}
	}

	return false;
}

/**
 * Update guest user task count
 */
export function updateGuestTaskCount(count: number) {
	const currentGuest = get(guestUser);
	if (currentGuest) {
		guestUser.set({
			...currentGuest,
			taskCount: count,
		});
	}
}

/**
 * Get current guest task count
 */
export async function getGuestTaskCount(): Promise<number> {
	const currentGuest = get(guestUser);
	if (!currentGuest?.workspace) return 0;

	try {
		const response = await fetch(
			`/api/tasks?workspaceId=${currentGuest.workspace.id}`,
		);
		const data = await response.json();

		if (response.ok) {
			const count = data.data?.items?.length || 0;
			updateGuestTaskCount(count);
			return count;
		}
	} catch (error) {
		console.error("Failed to get guest task count:", error);
	}

	return 0;
}

/**
 * Migrate guest tasks to authenticated user account
 */
export async function migrateGuestTasks(guestId: string): Promise<void> {
	try {
		const response = await fetch("/api/guest/migrate", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ guestId }),
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || "Failed to migrate guest tasks");
		}

		// Clear guest state
		guestUser.set(null);
		isGuestMode.set(false);

		return result.data;
	} catch (error) {
		console.error("Failed to migrate guest tasks:", error);
		throw error;
	}
}

/**
 * Get guest workspace for task operations
 */
export function getGuestWorkspace(): Workspace | null {
	const currentGuest = get(guestUser);
	return currentGuest?.workspace || null;
}
