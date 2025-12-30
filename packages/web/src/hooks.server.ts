import { SvelteKitAuth } from "@auth/sveltekit";
import Notion from "@auth/sveltekit/providers/notion";
import { UserService } from "@notion-task-manager/db";
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
				const userService = new UserService();

				try {
					// Check if user already exists in DynamoDB
					let dbUser = await userService.getUserByNotionId(user.id!);

					// Calculate token expiration (Notion tokens typically expire in 1 hour)
					const tokenExpiresAt = account.expires_at
						? new Date(account.expires_at * 1000)
						: new Date(Date.now() + 3600 * 1000); // Default 1 hour

					if (!dbUser) {
						// Create new user in DynamoDB
						dbUser = await userService.createUser({
							notionUserId: user.id!,
							email: user.email!,
							name: user.name!,
							avatarUrl: user.image || undefined,
							notionAccessToken: account.access_token!,
							notionRefreshToken: account.refresh_token || undefined,
							tokenExpiresAt,
						});
						console.log(`Created new user in DynamoDB: ${dbUser.id}`);
					} else {
						// Update existing user with fresh tokens and profile data
						dbUser = await userService.updateUser(dbUser.id, {
							email: user.email!,
							name: user.name!,
							avatarUrl: user.image || undefined,
							notionAccessToken: account.access_token!,
							notionRefreshToken: account.refresh_token || undefined,
							tokenExpiresAt,
						});
						console.log(`Updated existing user in DynamoDB: ${dbUser.id}`);
					}

					// Store user data in JWT token
					token.accessToken = account.access_token;
					token.notionUserId = user.id;
					token.userId = dbUser.id; // Use our internal UUID, not Notion's ID
					token.userEmail = user.email;
					token.userName = user.name;
					token.userImage = user.image;
				} catch (error) {
					console.error("Failed to save user to DynamoDB:", error);
					// Still allow login but log the error
					token.accessToken = account.access_token;
					token.notionUserId = user.id;
					token.userId = user.id; // Fallback to Notion ID
				}
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
				// Add additional user data to session
				if (token.userEmail)
					(session as any).user.email = token.userEmail as string;
				if (token.userName)
					(session as any).user.name = token.userName as string;
				if (token.userImage)
					(session as any).user.image = token.userImage as string;
			}
			// biome-ignore-end lint/suspicious/noExplicitAny: session
			return session;
		},
	},
});
