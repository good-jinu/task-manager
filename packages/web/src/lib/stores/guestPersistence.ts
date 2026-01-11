import type { Task } from "@notion-task-manager/db";
import { browser } from "$app/environment";

const GUEST_STORAGE_KEY = "taskflow_guest_data";
const GUEST_ID_KEY = "taskflow_guest_id";
const GUEST_WORKSPACE_KEY = "taskflow_guest_workspace";

export interface GuestBackupData {
	guestId: string;
	workspaceId: string;
	tasks: Task[];
	lastSync: string;
	deviceFingerprint: string;
}

// Generate a stable device fingerprint for guest identification
function generateDeviceFingerprint(): string {
	if (!browser) return "";

	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	ctx?.fillText("fingerprint", 2, 2);

	const fingerprint = [
		navigator.userAgent,
		navigator.language,
		`${screen.width}x${screen.height}`,
		new Date().getTimezoneOffset(),
		canvas.toDataURL(),
	].join("|");

	// Simple hash function
	let hash = 0;
	for (let i = 0; i < fingerprint.length; i++) {
		const char = fingerprint.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	return Math.abs(hash).toString(36);
}

export function saveGuestDataLocally(
	data: Omit<GuestBackupData, "deviceFingerprint" | "lastSync">,
) {
	if (!browser) return;

	const backupData: GuestBackupData = {
		...data,
		lastSync: new Date().toISOString(),
		deviceFingerprint: generateDeviceFingerprint(),
	};

	try {
		localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(backupData));
		localStorage.setItem(GUEST_ID_KEY, data.guestId);
		localStorage.setItem(GUEST_WORKSPACE_KEY, data.workspaceId);
	} catch (error) {
		console.warn("Failed to save guest data locally:", error);
	}
}

export function loadGuestDataLocally(): GuestBackupData | null {
	if (!browser) return null;

	try {
		const data = localStorage.getItem(GUEST_STORAGE_KEY);
		if (!data) return null;

		const parsed = JSON.parse(data) as GuestBackupData;

		// Verify device fingerprint matches (basic security)
		if (parsed.deviceFingerprint !== generateDeviceFingerprint()) {
			console.warn(
				"Device fingerprint mismatch, guest data may be from different device",
			);
			// Still return data but flag it
		}

		return parsed;
	} catch (error) {
		console.warn("Failed to load guest data locally:", error);
		return null;
	}
}
