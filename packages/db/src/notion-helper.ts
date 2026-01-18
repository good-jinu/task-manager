import { NotionAuthClient, NotionTaskManager } from "@task-manager/notion";
import type { User } from "./types";
import { UserService } from "./user-service";

/**
 * Create a NotionTaskManager with automatic token refresh capability
 * @param user - User object with tokens
 * @param clientId - Notion OAuth client ID
 * @param clientSecret - Notion OAuth client secret
 * @returns NotionTaskManager with auth client
 */
export function createNotionTaskManagerWithAuth(
	user: User,
	clientId: string,
	clientSecret: string,
): NotionTaskManager {
	console.log("[createNotionTaskManagerWithAuth] Creating Notion client:", {
		userId: user.id,
		hasAccessToken: !!user.notionAccessToken,
		hasRefreshToken: !!user.notionRefreshToken,
	});

	const authClient = new NotionAuthClient(user, {
		clientId,
		clientSecret,
		onTokenRefresh: async (
			userId: string,
			newAccessToken: string,
			newRefreshToken?: string,
			expiresAt?: string,
		) => {
			console.log(
				"[createNotionTaskManagerWithAuth] Token refresh callback triggered:",
				{
					userId,
				},
			);
			// Update user tokens in database when refreshed
			const userService = new UserService();
			await userService.updateUser(userId, {
				notionAccessToken: newAccessToken,
				...(newRefreshToken && { notionRefreshToken: newRefreshToken }),
				...(expiresAt && { tokenExpiresAt: expiresAt }),
			});
			console.log(
				`[createNotionTaskManagerWithAuth] Updated tokens in database for user: ${userId}`,
			);
		},
	});

	return new NotionTaskManager(authClient);
}
