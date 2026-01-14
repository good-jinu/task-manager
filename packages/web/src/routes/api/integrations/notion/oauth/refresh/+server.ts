import { json } from "@sveltejs/kit";
import { UserService } from "@task-manager/db";
import { AUTH_NOTION_ID, AUTH_NOTION_SECRET } from "$env/static/private";
import { requireAuth } from "$lib/auth";
import { getUserFromDatabase } from "$lib/user";
import { resilientOAuthOperation } from "$lib/utils/network-resilience";
import type { RequestHandler } from "./$types";

interface NotionTokenRefreshResponse {
	access_token: string;
	token_type: string;
	expires_in?: number;
}

interface NotionErrorResponse {
	error: string;
	error_description: string;
}

/**
 * POST /api/integrations/notion/oauth/refresh
 * Refreshes Notion OAuth tokens automatically
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		// Get user data to access current tokens
		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found" }, { status: 404 });
		}

		if (!user.notionRefreshToken) {
			return json(
				{
					error:
						"No refresh token available. Please reconnect your Notion account.",
					code: "NO_REFRESH_TOKEN",
				},
				{ status: 400 },
			);
		}

		// Check if token is actually expired or close to expiring
		if (user.tokenExpiresAt) {
			const expiresAt = new Date(user.tokenExpiresAt);
			const now = new Date();
			const timeUntilExpiry = expiresAt.getTime() - now.getTime();
			const fiveMinutes = 5 * 60 * 1000;

			// If token is still valid for more than 5 minutes, don't refresh
			if (timeUntilExpiry > fiveMinutes) {
				return json({
					success: true,
					message: "Token is still valid",
					expiresAt: user.tokenExpiresAt,
					refreshed: false,
				});
			}
		}

		// Attempt to refresh the token with network resilience
		const refreshResponse = await resilientOAuthOperation(async () => {
			return await fetch("https://api.notion.com/v1/oauth/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${Buffer.from(`${AUTH_NOTION_ID}:${AUTH_NOTION_SECRET}`).toString("base64")}`,
				},
				body: JSON.stringify({
					grant_type: "refresh_token",
					refresh_token: user.notionRefreshToken,
				}),
			});
		}, "notion");

		if (!refreshResponse.ok) {
			const errorData: NotionErrorResponse = await refreshResponse.json();
			console.error("Token refresh failed:", errorData);

			// If refresh token is invalid, user needs to re-authenticate
			if (errorData.error === "invalid_grant") {
				return json(
					{
						error:
							"Refresh token is invalid or expired. Please reconnect your Notion account.",
						code: "INVALID_REFRESH_TOKEN",
						requiresReauth: true,
					},
					{ status: 401 },
				);
			}

			return json(
				{
					error: "Failed to refresh access token",
					details: errorData.error_description || errorData.error,
					code: "REFRESH_FAILED",
				},
				{ status: 400 },
			);
		}

		const tokenData: NotionTokenRefreshResponse = await refreshResponse.json();

		// Calculate expiration time (if provided)
		let tokenExpiresAt: string | undefined;
		if (tokenData.expires_in) {
			const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
			tokenExpiresAt = expiresAt.toISOString();
		}

		// Update user with new tokens
		const userService = new UserService();
		await userService.updateUser(session.user.id, {
			notionAccessToken: tokenData.access_token,
			tokenExpiresAt,
		});

		return json({
			success: true,
			message: "Token refreshed successfully",
			expiresAt: tokenExpiresAt,
			refreshed: true,
		});
	} catch (error) {
		console.error("Token refresh error:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Token refresh processing failed",
				code: "REFRESH_ERROR",
			},
			{ status: 500 },
		);
	}
};

/**
 * GET /api/integrations/notion/oauth/refresh
 * Checks if token refresh is needed and returns status
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		// Get user data to check token status
		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found" }, { status: 404 });
		}

		if (!user.notionAccessToken) {
			return json({
				hasToken: false,
				needsRefresh: false,
				needsReauth: true,
				message: "No Notion access token found",
			});
		}

		let needsRefresh = false;
		let isExpired = false;

		if (user.tokenExpiresAt) {
			const expiresAt = new Date(user.tokenExpiresAt);
			const now = new Date();
			const timeUntilExpiry = expiresAt.getTime() - now.getTime();
			const fiveMinutes = 5 * 60 * 1000;

			isExpired = timeUntilExpiry <= 0;
			needsRefresh = timeUntilExpiry <= fiveMinutes;
		}

		return json({
			hasToken: true,
			needsRefresh,
			isExpired,
			needsReauth: isExpired && !user.notionRefreshToken,
			expiresAt: user.tokenExpiresAt,
			hasRefreshToken: !!user.notionRefreshToken,
		});
	} catch (error) {
		console.error("Token status check error:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to check token status",
			},
			{ status: 500 },
		);
	}
};
