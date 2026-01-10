import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { chatStatuses } from "$lib/services/chat-status";

/**
 * GET /api/ai/chat/[id]/status
 * Check the status of an async AI chat request
 */
export const GET = async (event: RequestEvent) => {
	try {
		const chatId = event.params.id;
		if (!chatId) {
			return json({ error: "Chat ID is required" }, { status: 400 });
		}

		// Check authentication (guest or authenticated user)
		let userId: string;
		try {
			const session = await event.locals.auth();
			if (!session?.user || !session.user.id) {
				throw new Error("Not authenticated");
			}
			userId = session.user.id;
		} catch {
			// Check for guest user ID in headers or cookies
			const guestId =
				event.request.headers.get("x-guest-id") ||
				event.cookies.get("guest-id");

			if (!guestId) {
				return json(
					{ error: "Authentication required or guest ID missing" },
					{ status: 401 },
				);
			}
			userId = guestId;
		}

		const status = chatStatuses.get(chatId);

		if (!status) {
			return json({ error: "Chat not found" }, { status: 404 });
		}

		// Don't override actual results with simulation
		// The async processing in the main chat endpoint will set the actual result

		return json({
			completed: status.completed,
			result: status.result,
			error: status.error,
		});
	} catch (error) {
		console.error("Failed to get chat status:", error);
		return json({ error: "Failed to get chat status" }, { status: 500 });
	}
};
