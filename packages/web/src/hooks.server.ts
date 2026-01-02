import { SvelteKitAuth } from "@auth/sveltekit";
import Notion from "@auth/sveltekit/providers/notion";
import { UserService } from "@notion-task-manager/db";
import { type Handle, redirect } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import {
	AUTH_NOTION_ID,
	AUTH_NOTION_REDIRECT_URI,
	AUTH_NOTION_SECRET,
	AUTH_SECRET,
} from "$env/static/private";

// Redirect handler for legacy routes
const redirectHandle: Handle = async ({ event, resolve }) => {
	// Redirect /search to /agent
	if (
		event.url.pathname === "/search" ||
		event.url.pathname.startsWith("/search/")
	) {
		redirect(301, "/agent");
	}
	return resolve(event);
};

const {
	handle: authHandle,
	signIn,
	signOut,
} = SvelteKitAuth({
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
		async signIn({ user, account }) {
			if (account && user) {
				const userService = new UserService();

				try {
					// Validate required user data from OAuth provider
					if (!user.id || !user.email || !user.name || !account.access_token) {
						return true; // Allow sign-in with fallback
					}

					// Check if user already exists in DynamoDB
					const notionUserId = account.providerAccountId || user.id;
					let dbUser = await userService.getUserByNotionId(notionUserId);

					// Calculate token expiration
					const tokenExpiresAt = account.expires_at
						? new Date(account.expires_at * 1000).toISOString()
						: new Date(Date.now() + 3600 * 1000).toISOString();

					if (!dbUser) {
						// Create new user in DynamoDB
						dbUser = await userService.createUser({
							notionUserId,
							email: user.email,
							name: user.name,
							avatarUrl: user.image || undefined,
							notionAccessToken: account.access_token,
							notionRefreshToken: account.refresh_token || undefined,
							tokenExpiresAt,
						});
					} else {
						// Update existing user with fresh tokens
						dbUser = await userService.updateUser(dbUser.id, {
							email: user.email,
							name: user.name,
							avatarUrl: user.image || undefined,
							notionAccessToken: account.access_token,
							notionRefreshToken: account.refresh_token || undefined,
							tokenExpiresAt,
						});
					}

					// Store the database user ID in the user object for JWT callback
					user.id = dbUser.id;
					return true;
				} catch (error) {
					console.error("Failed to save user to DynamoDB:", error);
					return true; // Allow sign-in with fallback
				}
			}
			return true;
		},
		async jwt({ token, user, account }) {
			// On initial sign-in, user and account are provided
			if (user) {
				token.userId = user.id;
				token.userEmail = user.email;
				token.userName = user.name;
				token.userImage = user.image;
			}

			// Store access token if available
			if (account?.access_token) {
				token.accessToken = account.access_token;
				token.notionUserId = account.providerAccountId;
			}

			return token;
		},
		async session({ session, token }) {
			// Pass user info and access token to session
			if (typeof token?.userId === "string") {
				session.user.id = token.userId;
				// Add additional user data to session
				if (typeof token.userEmail === "string")
					session.user.email = token.userEmail;
				if (typeof token.userName === "string")
					session.user.name = token.userName;
				if (typeof token.userImage === "string")
					session.user.image = token.userImage;
			}
			return session;
		},
	},
});

// Combine redirect handler with auth handler
export const handle = sequence(redirectHandle, authHandle);
export { signIn, signOut };
