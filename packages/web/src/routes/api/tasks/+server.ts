import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// TODO: Replace with actual database call using session.user.id
		// For now, return empty array as placeholder
		const tasks: any[] = [];

		return json({ tasks });
	} catch (error) {
		console.error("Failed to fetch tasks:", error);
		return json({ error: "Failed to fetch tasks" }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		const taskData = await event.request.json();

		// TODO: Replace with actual database call using session.user.id
		// For now, just return success

		return json({ success: true });
	} catch (error) {
		console.error("Failed to create task:", error);
		return json({ error: "Failed to create task" }, { status: 500 });
	}
};
