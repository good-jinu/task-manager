import type { User } from "@task-manager/db";
import { UserService } from "@task-manager/db";

/**
 * Gets user data from DynamoDB by user ID
 * @param userId - The user's UUID from our database or Notion ID as fallback
 * @returns User data or null if not found
 */
export async function getUserFromDatabase(
	userId: string,
): Promise<User | null> {
	const userService = new UserService();

	// First try to get by database UUID
	let user = await userService.getUserById(userId);

	// If not found, try by Notion ID (fallback case)
	if (!user) {
		user = await userService.getUserByNotionId(userId);
	}

	return user;
}

/**
 * Gets user data from DynamoDB by Notion user ID
 * @param notionUserId - The user's Notion ID
 * @returns User data or null if not found
 */
export async function getUserByNotionId(
	notionUserId: string,
): Promise<User | null> {
	const userService = new UserService();
	return await userService.getUserByNotionId(notionUserId);
}
