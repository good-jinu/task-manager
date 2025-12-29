import { SvelteKitAuth } from "@auth/sveltekit";
import Notion from "@auth/sveltekit/providers/notion";
import {
	AUTH_NOTION_ID,
	AUTH_NOTION_REDIRECT_URI,
	AUTH_NOTION_SECRET,
	AUTH_SECRET,
} from "$env/static/private";

export const { handle, signIn, signOut } = SvelteKitAuth({
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
		signIn: "/user/signin",
		error: "/user/error",
	},
	callbacks: {
		async jwt({ token, user, account }) {
			// Store Notion access token and user info in JWT
			if (account && user) {
				token.accessToken = account.access_token;
				token.notionUserId = user.id;
				token.userId = user.id; // Use Notion ID as our user ID
			}
			return token;
		},
		async session({ session, token }) {
			// Pass user info and access token to session
			// biome-ignore-start lint/suspicious/noExplicitAny: session
			if (token) {
				(session as any).user.id = token.userId as string;
				(session as any).accessToken = token.accessToken as string;
				(session as any).notionUserId = token.notionUserId as string;
			}
			// biome-ignore-end lint/suspicious/noExplicitAny: session
			return session;
		},
	},
});
