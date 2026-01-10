import { IntegrationService, UserService } from "@notion-task-manager/db";
import { json, redirect } from "@sveltejs/kit";
import { AUTH_NOTION_ID, AUTH_NOTION_SECRET } from "$env/static/private";
import { requireAuth } from "$lib/auth";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";

interface NotionOAuthTokenResponse {
	access_token: string;
	token_type: string;
	bot_id: string;
	workspace_name: string;
	workspace_icon: string;
	workspace_id: string;
	owner: {
		type: string;
		user: {
			object: string;
			id: string;
			name: string;
			avatar_url: string;
			type: string;
			person: {
				email: string;
			};
		};
	};
	duplicated_template_id?: string;
}

interface NotionErrorResponse {
	error: string;
	error_description: string;
}

/**
 * GET /api/integrations/notion/oauth/callback
 * Handles Notion OAuth callback and exchanges code for tokens
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const code = event.url.searchParams.get("code");
		const state = event.url.searchParams.get("state");
		const error = event.url.searchParams.get("error");

		// Handle OAuth errors
		if (error) {
			const errorDescription = event.url.searchParams.get("error_description");
			console.error("Notion OAuth error:", error, errorDescription);

			// Clear state cookie
			event.cookies.delete("notion_oauth_state", { path: "/" });

			return json(
				{
					error: "OAuth authorization failed",
					details: errorDescription || error,
				},
				{ status: 400 },
			);
		}

		if (!code || !state) {
			return json(
				{
					error: "Missing authorization code or state parameter",
				},
				{ status: 400 },
			);
		}

		// Verify state parameter for CSRF protection
		const stateCookie = event.cookies.get("notion_oauth_state");
		if (!stateCookie) {
			return json(
				{
					error: "Invalid or expired OAuth state",
				},
				{ status: 400 },
			);
		}

		let stateData: {
			workspaceId: string;
			userId: string;
			timestamp: number;
			redirectUri: string;
		};
		try {
			stateData = JSON.parse(stateCookie);
		} catch {
			return json(
				{
					error: "Invalid OAuth state format",
					code: "INVALID_STATE_FORMAT",
				},
				{ status: 400 },
			);
		}

		// Verify the user ID matches the current session
		if (stateData.userId !== session.user.id) {
			return json(
				{
					error: "OAuth state user mismatch",
					code: "USER_MISMATCH",
				},
				{ status: 400 },
			);
		}

		// Check state timestamp (should be within 10 minutes)
		const stateAge = Date.now() - stateData.timestamp;
		if (stateAge > 600000) {
			// 10 minutes
			event.cookies.delete("notion_oauth_state", { path: "/" });
			return json(
				{
					error: "OAuth state expired",
					code: "STATE_EXPIRED",
				},
				{ status: 400 },
			);
		}

		// Clear state cookie
		event.cookies.delete("notion_oauth_state", { path: "/" });

		// Exchange code for tokens
		const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${Buffer.from(`${AUTH_NOTION_ID}:${AUTH_NOTION_SECRET}`).toString("base64")}`,
			},
			body: JSON.stringify({
				grant_type: "authorization_code",
				code,
				redirect_uri: stateData.redirectUri,
			}),
		});

		if (!tokenResponse.ok) {
			const errorData: NotionErrorResponse = await tokenResponse.json();
			console.error("Token exchange failed:", errorData);
			return json(
				{
					error: "Failed to exchange authorization code",
					details: errorData.error_description || errorData.error,
				},
				{ status: 400 },
			);
		}

		const tokenData: NotionOAuthTokenResponse = await tokenResponse.json();

		// Calculate token expiration (Notion tokens typically don't expire, but we'll set a long expiration)
		const tokenExpiresAt = new Date(
			Date.now() + 365 * 24 * 60 * 60 * 1000,
		).toISOString(); // 1 year

		// Update user with Notion tokens
		const userService = new UserService();
		await userService.updateUser(session.user.id, {
			notionAccessToken: tokenData.access_token,
			// Notion doesn't provide refresh tokens in OAuth flow typically
			// But we'll store the expiration for future reference
			tokenExpiresAt,
		});

		// Get updated user data
		const updatedUser = await getUserFromDatabase(session.user.id);
		if (!updatedUser) {
			return json(
				{
					error: "Failed to retrieve updated user data",
				},
				{ status: 500 },
			);
		}

		// Redirect to frontend with success parameters
		const redirectUrl = new URL("/", event.url.origin);
		redirectUrl.searchParams.set("oauth_success", "notion");
		redirectUrl.searchParams.set("workspace_id", stateData.workspaceId);
		redirectUrl.searchParams.set("workspace_name", tokenData.workspace_name);

		throw redirect(302, redirectUrl.toString());
	} catch (error) {
		console.error("OAuth callback error:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "OAuth callback processing failed",
			},
			{ status: 500 },
		);
	}
};
