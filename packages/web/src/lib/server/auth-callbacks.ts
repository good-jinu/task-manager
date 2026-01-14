import type { Account, User } from "@auth/sveltekit";
import { UserService, WorkspaceService } from "@task-manager/db";

/**
 * Handle user sign-in process
 */
export async function handleSignIn(
	user: User,
	account: Account | null,
): Promise<boolean> {
	if (!account || !user) {
		return true; // Allow sign-in with fallback
	}

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
			dbUser = await createNewUser(userService, {
				notionUserId,
				email: user.email,
				name: user.name,
				avatarUrl: user.image || undefined,
				notionAccessToken: account.access_token,
				notionRefreshToken: account.refresh_token || undefined,
				tokenExpiresAt,
			});

			// Mark as new user for client-side handling
			user.isNewUser = true;
		} else {
			// Update existing user with fresh tokens
			dbUser = await updateExistingUser(userService, dbUser.id, {
				email: user.email,
				name: user.name,
				avatarUrl: user.image || undefined,
				notionAccessToken: account.access_token,
				notionRefreshToken: account.refresh_token || undefined,
				tokenExpiresAt,
			});
			user.isNewUser = false;
		}

		// Handle workspace creation for new users
		if (isNewUser) {
			await handleNewUserWorkspace(dbUser.id);
		}

		// Store the database user ID in the user object for JWT callback
		user.id = dbUser.id;
		return true;
	} catch (error) {
		console.error("Failed to save user to DynamoDB:", error);
		return true; // Allow sign-in with fallback
	}
}

/**
 * Create a new user in the database
 */
async function createNewUser(
	userService: UserService,
	userData: {
		notionUserId: string;
		email: string;
		name: string;
		avatarUrl?: string;
		notionAccessToken: string;
		notionRefreshToken?: string;
		tokenExpiresAt: string;
	},
) {
	return await userService.createUser(userData);
}

/**
 * Update an existing user with fresh tokens
 */
async function updateExistingUser(
	userService: UserService,
	userId: string,
	updates: {
		email: string;
		name: string;
		avatarUrl?: string;
		notionAccessToken: string;
		notionRefreshToken?: string;
		tokenExpiresAt: string;
	},
) {
	return await userService.updateUser(userId, updates);
}

/**
 * Handle workspace creation for new users
 */
async function handleNewUserWorkspace(userId: string): Promise<void> {
	try {
		const workspaceService = new WorkspaceService();
		const existingWorkspaces = await workspaceService.listWorkspaces(userId);

		// Only create default workspace if no workspaces exist
		// (guest workspace transfer might have already created one)
		if (existingWorkspaces.length === 0) {
			await workspaceService.createWorkspace(userId, {
				name: "My Tasks",
			});
		}
	} catch (workspaceError) {
		console.error("Failed to create default workspace:", workspaceError);
		// Don't fail the sign-in process if workspace creation fails
	}
}
