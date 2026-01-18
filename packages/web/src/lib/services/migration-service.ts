import { browser } from "$app/environment";

/**
 * Clear all guest data from localStorage
 */
function clearGuestData(): void {
	if (!browser) return;

	console.log("[clearGuestData] Clearing all guest data from localStorage");
	localStorage.removeItem("guest-id");
	localStorage.removeItem("guest-backup");
	localStorage.removeItem("pending_migration");
	console.log("[clearGuestData] Guest data cleared");
}

/**
 * Handle pending guest data migration after authentication
 */
export async function handlePendingMigration(
	isNewUser: boolean,
): Promise<boolean> {
	console.log("[handlePendingMigration] Starting migration check", {
		isNewUser,
		browser,
	});

	if (!browser) return false;

	try {
		// Check if this is a new user who might have guest data to migrate
		if (!isNewUser) {
			console.log(
				"[handlePendingMigration] Not a new user, skipping migration",
			);
			localStorage.removeItem("pending_migration");
			return false;
		}

		// Get guest ID from localStorage
		const guestId = localStorage.getItem("guest-id");
		console.log("[handlePendingMigration] Guest ID check", { guestId });

		if (!guestId) {
			console.log("[handlePendingMigration] No guest ID found, skipping");
			localStorage.removeItem("pending_migration");
			return false;
		}

		console.log(
			"[handlePendingMigration] Attempting to transfer guest workspace for new user",
			{ guestId },
		);

		// Call the migration API to transfer workspace ownership
		const response = await fetch("/api/migrate-guest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ guestId }),
		});

		const result = await response.json();

		console.log("[handlePendingMigration] Migration API response", {
			ok: response.ok,
			status: response.status,
			result,
		});

		if (response.ok && result.success) {
			console.log(
				"[handlePendingMigration] Guest workspace transfer completed successfully",
				{
					workspaceId: result.workspaceId,
					message: result.message,
				},
			);
			// Clear guest data from localStorage since it's now owned by the user
			clearGuestData();
			return true;
		} else {
			console.warn("[handlePendingMigration] Guest workspace transfer failed", {
				message: result.message,
				error: result.error,
			});
			// Clear pending migration flag even if transfer failed
			localStorage.removeItem("pending_migration");
			return false;
		}
	} catch (error) {
		console.error(
			"[handlePendingMigration] Error handling guest workspace transfer:",
			error,
		);
		localStorage.removeItem("pending_migration");
		return false;
	}
}

/**
 * Set up migration for guest data when user signs up
 */
export function setupMigration(hasGuestData: boolean): void {
	if (!browser) return;

	console.log("[setupMigration] Setting up migration", { hasGuestData });

	if (hasGuestData) {
		localStorage.setItem("pending_migration", "true");
		console.log("[setupMigration] Migration flag set to true");
	} else {
		localStorage.removeItem("pending_migration");
		console.log("[setupMigration] Migration flag removed");
	}
}

/**
 * Check if there's pending migration
 */
export function hasPendingMigration(): boolean {
	if (!browser) return false;
	return localStorage.getItem("pending_migration") === "true";
}
