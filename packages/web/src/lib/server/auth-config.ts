import type { SvelteKitAuthConfig } from "@auth/sveltekit";
import Notion from "@auth/sveltekit/providers/notion";
import {
	AUTH_NOTION_ID,
	AUTH_NOTION_REDIRECT_URI,
	AUTH_NOTION_SECRET,
	AUTH_SECRET,
} from "$env/static/private";
import { handleSignIn } from "./auth-callbacks";
import { handleJWT } from "./jwt-handler";
import { handleSession } from "./session-handler";

/**
 * Create the authentication configuration
 */
export function createAuthConfig(): SvelteKitAuthConfig {
	return {
		providers: [
			Notion({
				clientId: AUTH_NOTION_ID,
				clientSecret: AUTH_NOTION_SECRET,
				redirectUri: AUTH_NOTION_REDIRECT_URI,
			}),
		],
		secret: AUTH_SECRET,
		trustHost: true,
		basePath: "/auth",
		pages: {
			signIn: "/",
			error: "/",
		},
		callbacks: {
			async signIn({ user, account }) {
				return await handleSignIn(user, account || null);
			},
			async jwt({ token, user, account }) {
				return await handleJWT({ token, user, account });
			},
			async session({ session, token }) {
				return await handleSession({ session, token });
			},
		},
	};
}
