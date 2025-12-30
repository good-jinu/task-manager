import type { User } from "@notion-task-manager/db";
import { UserService } from "@notion-task-manager/db";
import {
	Client,
	NotionAuthClient,
	NotionTaskManager,
} from "@notion-task-manager/notion";
import { AUTH_NOTION_ID, AUTH_NOTION_SECRET } from "$env/static/private";

export function createNotionClient(accessToken: string): Client {
	return new Client({
		auth: accessToken,
	});
}

export function createNotionTaskManager(
	accessToken: string,
): NotionTaskManager {
	const client = createNotionClient(accessToken);
	return new NotionTaskManager(client);
}

/**
 * Create a NotionTaskManager with automatic token refresh capability
 * @param user - User object with tokens
 * @returns NotionTaskManager with auth client
 */
export function createNotionTaskManagerWithAuth(user: User): NotionTaskManager {
	const authClient = new NotionAuthClient(user, {
		clientId: AUTH_NOTION_ID,
		clientSecret: AUTH_NOTION_SECRET,
		onTokenRefresh: async (
			userId,
			newAccessToken,
			newRefreshToken,
			expiresAt,
		) => {
			// Update user tokens in database when refreshed
			const userService = new UserService();
			await userService.updateUser(userId, {
				notionAccessToken: newAccessToken,
				...(newRefreshToken && { notionRefreshToken: newRefreshToken }),
				...(expiresAt && { tokenExpiresAt: expiresAt }),
			});
			console.log(`Updated tokens in database for user: ${userId}`);
		},
	});

	return new NotionTaskManager(authClient);
}
