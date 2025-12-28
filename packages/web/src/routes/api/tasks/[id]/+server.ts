import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

export const PUT: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		const taskId = event.params.id;
		const updateData = await event.request.json();

		// TODO: Replace with actual database call using session.user.id
		// Verify task ownership before updating

		return json({ success: true });
	} catch (error) {
		console.error("Failed to update task:", error);
		return json({ error: "Failed to update task" }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		const taskId = event.params.id;

		// TODO: Replace with actual database call using session.user.id
		// Verify task ownership before deleting

		return json({ success: true });
	} catch (error) {
		console.error("Failed to delete task:", error);
		return json({ error: "Failed to delete task" }, { status: 500 });
	}
};
