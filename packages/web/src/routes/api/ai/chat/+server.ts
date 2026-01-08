import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ERROR_MESSAGES } from "$lib/constants/chat";
import { ChatService } from "$lib/services/chat-service";
import {
	isGuestUser,
	sanitizeMessage,
	ValidationError,
	validateWorkspaceId,
} from "$lib/utils/validation";

const chatService = new ChatService();

export const POST = async (event: RequestEvent) => {
	try {
		// Check if user is authenticated or guest
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
					{ error: ERROR_MESSAGES.AUTHENTICATION_REQUIRED },
					{ status: 401 },
				);
			}
			userId = guestId;
		}

		const requestBody = await event.request.json();
		const { message, workspaceId } = requestBody;

		// Validate and sanitize inputs
		let sanitizedMessage: string;
		let validatedWorkspaceId: string;

		try {
			sanitizedMessage = sanitizeMessage(message);
			validatedWorkspaceId = validateWorkspaceId(workspaceId);
		} catch (error) {
			if (error instanceof ValidationError) {
				return json({ error: error.message }, { status: 400 });
			}
			throw error;
		}

		// Basic rate limiting check for guest users
		if (isGuestUser(userId)) {
			// TODO: Implement proper rate limiting with Redis or DynamoDB
			console.log(`Guest user ${userId} making chat request`);
		}

		// Process the message using ChatService
		const response = await chatService.processMessage(
			sanitizedMessage,
			validatedWorkspaceId,
			userId,
		);

		if (response.success) {
			return json({
				success: true,
				content: response.content,
				tasks: response.tasks || [],
			});
		} else {
			return json({ error: response.content }, { status: 500 });
		}
	} catch (error) {
		console.error("AI chat failed:", error);

		// Log detailed error information
		const errorDetails = {
			message: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : undefined,
			timestamp: new Date().toISOString(),
		};
		console.error("Chat API error details:", errorDetails);

		if (error instanceof Error) {
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token")
			) {
				return json({ error: "Authentication error" }, { status: 401 });
			}

			if (error.message.includes("validation")) {
				return json({ error: "Invalid input data" }, { status: 400 });
			}
		}

		return json({ error: ERROR_MESSAGES.GENERAL_ERROR }, { status: 500 });
	}
};
