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

		const { workspaceId, redirectUri } = await event.request.json();

		if (!workspaceId) {
			return json({ error: "workspaceId is required" }, { status: 400 });
		}

		// Validate redirect URI (should be from same origin for security)
		const origin = event.url.origin;
		const validRedirectUri =
			redirectUri || `${origin}/api/integrations/notion/oauth/callback`;

		// Generate state parameter for CSRF protection
		const state = crypto.randomUUID();

		// Store state and workspace info in session/cookie for callback verification
		// In production, you might want to use a more secure session store
		const stateData = {
			workspaceId,
			redirectUri: validRedirectUri,
			timestamp: Date.now(),
		};

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
			authUrl: notionAuthUrl.toString(),
			state,
		});
	} catch (error) {
		console.error("Failed to initiate Notion OAuth:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json({ error: "Failed to initiate OAuth flow" }, { status: 500 });
	}
};
