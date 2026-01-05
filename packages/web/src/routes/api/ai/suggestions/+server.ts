import { createAIAgentService } from "@notion-task-manager/core";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	try {
		// Check if user is authenticated or guest
		let _userId: string;
		try {
			const session = await event.locals.auth();
			if (!session?.user || !session.user.id) {
				throw new Error("Not authenticated");
			}
			_userId = session.user.id;
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
			_userId = guestId;
		}

		const requestBody = await event.request.json();
		const { workspaceId, context } = requestBody;

		// Validate required fields
		if (
			!workspaceId ||
			typeof workspaceId !== "string" ||
			!workspaceId.trim()
		) {
			return json(
				{ error: "Workspace ID is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		// Validate optional context
		if (context !== undefined && typeof context !== "string") {
			return json(
				{ error: "Context must be a string if provided" },
				{ status: 400 },
			);
		}

		// Create AI agent service
		const aiService = createAIAgentService();

		// Generate task suggestions
		const suggestions = await aiService.generateTaskSuggestions(
			workspaceId.trim(),
			context?.trim(),
		);

		return json({
			success: true,
			suggestions,
		});
	} catch (error) {
		console.error("AI task suggestions failed:", error);

		if (error instanceof Error) {
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token")
			) {
				return json({ error: "Authentication error" }, { status: 401 });
			}
		}

		return json(
			{ error: "Failed to generate task suggestions" },
			{ status: 500 },
		);
	}
};
