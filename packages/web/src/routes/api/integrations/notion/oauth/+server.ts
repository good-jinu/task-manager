import { json, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { AUTH_NOTION_ID } from "$env/static/private";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * POST /api/integrations/notion/oauth
 * Initiates Notion OAuth flow by redirecting to Notion's authorization page
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Require authentication for OAuth initiation
		const session = await requireAuth(event);

		const { workspaceId, redirectUri, scopes } = await event.request.json();

		if (!workspaceId) {
			return json({ error: "workspaceId is required" }, { status: 400 });
		}

		// Validate redirect URI (should be from same origin for security)
		const origin = event.url.origin;
		let validRedirectUri =
			redirectUri || `${origin}/api/integrations/notion/oauth/callback`;

		// Ensure redirect URI is from same origin for security
		try {
			const redirectUrl = new URL(validRedirectUri);
			if (redirectUrl.origin !== origin) {
				return json(
					{ error: "Redirect URI must be from the same origin" },
					{ status: 400 },
				);
			}
		} catch {
			return json({ error: "Invalid redirect URI format" }, { status: 400 });
		}

		// Generate state parameter for CSRF protection
		const state = crypto.randomUUID();

		// Store state and workspace info in session/cookie for callback verification
		const stateData = {
			workspaceId,
			userId: session.user.id,
			redirectUri: validRedirectUri,
			timestamp: Date.now(),
		};

		// Default scopes for Notion integration
		const defaultScopes = ["read_content", "update_content", "insert_content"];
		const requestedScopes = scopes || defaultScopes;

		// Notion OAuth parameters
		const notionAuthUrl = new URL("https://api.notion.com/v1/oauth/authorize");
		notionAuthUrl.searchParams.set("client_id", AUTH_NOTION_ID);
		notionAuthUrl.searchParams.set("response_type", "code");
		notionAuthUrl.searchParams.set("owner", "user");
		notionAuthUrl.searchParams.set("redirect_uri", validRedirectUri);
		notionAuthUrl.searchParams.set("state", state);

		// Set state cookie for callback verification
		event.cookies.set("notion_oauth_state", JSON.stringify(stateData), {
			httpOnly: true,
			secure: !dev,
			sameSite: "lax",
			maxAge: 600, // 10 minutes
			path: "/",
		});

		return json({
			success: true,
			authUrl: notionAuthUrl.toString(),
			state,
			expiresAt: new Date(Date.now() + 600000).toISOString(), // 10 minutes
		});
	} catch (error) {
		console.error("Failed to initiate Notion OAuth:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to initiate OAuth flow",
				code: "OAUTH_INIT_FAILED",
			},
			{ status: 500 },
		);
	}
};

/**
 * GET /api/integrations/notion/oauth
 * Gets OAuth configuration and status
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const workspaceId = event.url.searchParams.get("workspaceId");

		if (!workspaceId) {
			return json(
				{ error: "workspaceId parameter is required" },
				{ status: 400 },
			);
		}

		// Check if there's an active OAuth state
		const stateCookie = event.cookies.get("notion_oauth_state");
		let activeOAuthFlow = false;
		let oauthExpiresAt: string | undefined;

		if (stateCookie) {
			try {
				const stateData = JSON.parse(stateCookie);
				const stateAge = Date.now() - stateData.timestamp;

				if (stateAge <= 600000) {
					// 10 minutes
					activeOAuthFlow = true;
					oauthExpiresAt = new Date(stateData.timestamp + 600000).toISOString();
				}
			} catch {
				// Invalid state cookie, ignore
			}
		}

		return json({
			clientId: AUTH_NOTION_ID,
			redirectUri: `${event.url.origin}/api/integrations/notion/oauth/callback`,
			scopes: ["read_content", "update_content", "insert_content"],
			activeOAuthFlow,
			oauthExpiresAt,
		});
	} catch (error) {
		console.error("Failed to get OAuth configuration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to get OAuth configuration",
			},
			{ status: 500 },
		);
	}
};
