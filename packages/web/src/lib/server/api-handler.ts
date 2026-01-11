import { ValidationError } from "@notion-task-manager/db";
import { json, type RequestEvent } from "@sveltejs/kit";
import { type AuthResult, getAuthStatus } from "./auth-service";

export interface ApiHandlerOptions {
	requireAuth?: boolean;
	allowGuest?: boolean;
}

export type ApiHandler<T> = (
	event: RequestEvent,
	authResult: AuthResult,
) => Promise<T>;

/**
 * Handle API requests with common authentication and error handling
 */
export async function handleRequest<T>(
	event: RequestEvent,
	handler: ApiHandler<T>,
	options: ApiHandlerOptions = {},
) {
	const { requireAuth = false, allowGuest = true } = options;

	try {
		// Get authentication status
		const authResult = await getAuthStatus(event);

		// Check authentication requirements
		if (requireAuth && (!authResult || authResult.isGuest)) {
			return json({ error: "Authentication required" }, { status: 401 });
		}

		if (!allowGuest && authResult?.isGuest) {
			return json(
				{ error: "Guest access not allowed for this endpoint" },
				{ status: 403 },
			);
		}

		if (!authResult) {
			return json(
				{ error: "Authentication required or guest ID missing" },
				{ status: 401 },
			);
		}

		// Execute the handler
		const result = await handler(event, authResult);

		// Return successful result
		if (result && typeof result === "object" && "success" in result) {
			return json(result);
		}

		return json({ success: true, data: result });
	} catch (error) {
		console.error("API request failed:", error);

		// Handle redirect errors (from auth)
		if (error instanceof Error && error.message.includes("redirect")) {
			throw error;
		}

		// Handle validation errors
		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		// Handle generic errors
		const errorMessage =
			error instanceof Error ? error.message : "Internal server error";
		return json({ error: errorMessage }, { status: 500 });
	}
}

/**
 * Handle GET requests
 */
export async function handleGet<T>(
	event: RequestEvent,
	handler: ApiHandler<T>,
	options?: ApiHandlerOptions,
) {
	return handleRequest(event, handler, options);
}

/**
 * Handle POST requests
 */
export async function handlePost<T>(
	event: RequestEvent,
	handler: ApiHandler<T>,
	options?: ApiHandlerOptions,
) {
	return handleRequest(event, handler, options);
}

/**
 * Handle PUT requests
 */
export async function handlePut<T>(
	event: RequestEvent,
	handler: ApiHandler<T>,
	options?: ApiHandlerOptions,
) {
	return handleRequest(event, handler, options);
}

/**
 * Handle DELETE requests
 */
export async function handleDelete<T>(
	event: RequestEvent,
	handler: ApiHandler<T>,
	options?: ApiHandlerOptions,
) {
	return handleRequest(event, handler, options);
}
