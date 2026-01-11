import { browser } from "$app/environment";

/**
 * Clear all guest data from localStorage
 */
function clearGuestData(): void {
	if (!browser) return;

	localStorage.removeItem("guest-id");
	localStorage.removeItem("guest-backup");
	localStorage.removeItem("pending_migration");
}

/**
 * Handle pending guest data migration after authentication
 */
export async function handlePendingMigration(
	isNewUser: boolean,
): Promise<boolean> {
	if (!browser) return false;

	try {
		// Check if this is a new user who might have guest data to migrate
		if (!isNewUser) {
			localStorage.removeItem("pending_migration");
			return false;
		}

		// Get guest ID from localStorage
		const guestId = localStorage.getItem("guest-id");
		if (!guestId) {
			localStorage.removeItem("pending_migration");
			return false;
		}

		console.log("Attempting to transfer guest workspace for new user...");

		// Call the migration API to transfer workspace ownership
		const response = await fetch("/api/migrate-guest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ guestId }),
		});

		const result = await response.json();

		if (response.ok && result.success) {
			console.log("Guest workspace transfer completed successfully");
			// Clear guest data from localStorage since it's now owned by the user
			clearGuestData();
			return true;
		} else {
			console.warn("Guest workspace transfer failed:", result.message);
			// Clear pending migration flag even if transfer failed
			localStorage.removeItem("pending_migration");
			return false;
		}
	} catch (error) {
		console.error("Error handling guest workspace transfer:", error);
		localStorage.removeItem("pending_migration");
		return false;
	}
}

/**
 * Set up migration for guest data when user signs up
 */
export function setupMigration(hasGuestData: boolean): void {
	if (!browser) return;

	if (hasGuestData) {
		localStorage.setItem("pending_migration", "true");
	} else {
		localStorage.removeItem("pending_migration");
	}
}

/**
 * Check if there's pending migration
 */
export function hasPendingMigration(): boolean {
	if (!browser) return false;
	return localStorage.getItem("pending_migration") === "true";
}
