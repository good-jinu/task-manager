import { getDatabaseClient } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Get saved database configurations
		const db = getDatabaseClient();
		const configs = await db.databaseConfigs.getDatabaseConfigs(
			session.user.id,
		);

		// Convert Date objects to strings for client compatibility
		const clientConfigs = configs.map((config) => ({
			...config,
			selectedAt: config.selectedAt.toISOString(),
		}));

		return json({ configs: clientConfigs });
	} catch (error) {
		console.error("Failed to fetch database configurations:", error);
		return json(
			{ error: "Failed to fetch database configurations" },
			{ status: 500 },
		);
	}
};
