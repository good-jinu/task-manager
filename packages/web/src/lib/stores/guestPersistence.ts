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

export function clearGuestDataLocally() {
	if (!browser) return;

	localStorage.removeItem(GUEST_STORAGE_KEY);
	localStorage.removeItem(GUEST_ID_KEY);
	localStorage.removeItem(GUEST_WORKSPACE_KEY);
}

export function getStoredGuestId(): string | null {
	if (!browser) return null;
	return localStorage.getItem(GUEST_ID_KEY);
}

export function getStoredWorkspaceId(): string | null {
	if (!browser) return null;
	return localStorage.getItem(GUEST_WORKSPACE_KEY);
}

// Sync local tasks with server tasks, merging any differences
export function mergeTasks(localTasks: Task[], serverTasks: Task[]): Task[] {
	const taskMap = new Map<string, Task>();

	// Add server tasks first
	serverTasks.forEach((task) => {
		taskMap.set(task.id, task);
	});

	// Add local tasks, preferring newer ones
	localTasks.forEach((localTask) => {
		const serverTask = taskMap.get(localTask.id);
		if (!serverTask) {
			// Local task doesn't exist on server, keep it
			taskMap.set(localTask.id, localTask);
		} else {
			// Compare timestamps and keep the newer one
			const localTime = new Date(
				localTask.updatedAt || localTask.createdAt,
			).getTime();
			const serverTime = new Date(
				serverTask.updatedAt || serverTask.createdAt,
			).getTime();

			if (localTime > serverTime) {
				taskMap.set(localTask.id, localTask);
			}
		}
	});

	return Array.from(taskMap.values()).sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}
