import { SvelteKitAuth } from "@auth/sveltekit";
import Notion from "@auth/sveltekit/providers/notion";
import { UserService } from "@notion-task-manager/db";
import {
	AUTH_NOTION_ID,
	AUTH_NOTION_REDIRECT_URI,
	AUTH_NOTION_SECRET,
	AUTH_SECRET,
} from "$env/static/private";
import "$lib/types/auth"; // Import auth type extensions

// No redirect handlers needed - all routes are direct

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
		signIn: "/",
		error: "/",
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

					const isNewUser = !dbUser;

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

						// For new users, check if there's a guest workspace to transfer
						// This will be handled in the client-side after authentication
						// We just need to mark this as a new user for the client
						user.isNewUser = true;
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
						user.isNewUser = false;
					}

					// If this is a new user and no workspace exists, create a default one
					if (isNewUser) {
						try {
							const { WorkspaceService } = await import(
								"@notion-task-manager/db"
							);
							const workspaceService = new WorkspaceService();
							const existingWorkspaces = await workspaceService.listWorkspaces(
								dbUser.id,
							);

							// Only create default workspace if no workspaces exist
							// (guest workspace transfer might have already created one)
							if (existingWorkspaces.length === 0) {
								await workspaceService.createWorkspace(dbUser.id, {
									name: "My Tasks",
								});
							}
						} catch (workspaceError) {
							console.error(
								"Failed to create default workspace:",
								workspaceError,
							);
							// Don't fail the sign-in process if workspace creation fails
						}
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
				token.isNewUser = user.isNewUser || false;
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
				if (typeof token.isNewUser === "boolean")
					session.user.isNewUser = token.isNewUser;
			}
			return session;
		},
	},
});

// Use only auth handler
export const handle = authHandle;
export { signIn, signOut };
