import type { Workspace } from "@task-manager/db";
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
		if (guestId?.startsWith("guest_")) {
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
 * Get guest workspace for task operations
 */
export function getGuestWorkspace(): Workspace | null {
	const currentGuest = get(guestUser);
	return currentGuest?.workspace || null;
}
