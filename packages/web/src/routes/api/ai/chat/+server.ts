import { ChatService } from "@notion-task-manager/core";
import { type Task, TaskService } from "@notion-task-manager/db";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ERROR_MESSAGES } from "$lib/constants/chat";
import { chatStatuses } from "$lib/services/chat-status";
import {
	isGuestUser,
	sanitizeMessage,
	ValidationError,
	validateWorkspaceId,
} from "$lib/utils/validation";

const chatService = new ChatService();
const taskService = new TaskService();

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
		const { message, workspaceId, contextTasks = [] } = requestBody;

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

		// Generate chat ID for async processing
		const chatId =
			Date.now().toString() + Math.random().toString(36).substr(2, 9);

		// Store initial status
		chatStatuses.set(chatId, {
			completed: false,
			startTime: Date.now(),
		});

		// Start async processing (in real implementation, this would be a background job)
		processMessageAsync(
			chatId,
			sanitizedMessage,
			validatedWorkspaceId,
			userId,
			contextTasks,
		);

		// Return immediately with chat ID
		return json({
			success: true,
			chatId: chatId,
			message: "Processing your request...",
		});
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

/**
 * Process message asynchronously (simulated)
 * In a real implementation, this would be handled by a background job queue
 */
async function processMessageAsync(
	chatId: string,
	message: string,
	workspaceId: string,
	userId: string,
	contextTasks: Task[] = [],
) {
	try {
		// Simulate processing delay
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Process the message using ChatService
		const response = await chatService.processMessage(
			message,
			workspaceId,
			userId,
			taskService,
			contextTasks as Task[],
		);

		// Update status with result
		const status = chatStatuses.get(chatId);
		if (status) {
			status.completed = true;
			status.result = {
				content: response.content,
				tasks: response.tasks || [],
			};
			if (!response.success) {
				status.error = response.content;
			}
			chatStatuses.set(chatId, status);
		}
	} catch (error) {
		console.error("Async message processing failed:", error);

		// Update status with error
		const status = chatStatuses.get(chatId);
		if (status) {
			status.completed = true;
			status.error =
				error instanceof Error ? error.message : "Processing failed";
			chatStatuses.set(chatId, status);
		}
	}
}
