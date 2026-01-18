import type { Account, User } from "@auth/sveltekit";
import { UserService, WorkspaceService } from "@task-manager/db";

/**
 * Handle user sign-in process
 */
export async function handleSignIn(
	user: User,
	account: Account | null,
): Promise<boolean> {
	console.log("[handleSignIn] Starting sign-in process", {
		hasUser: !!user,
		hasAccount: !!account,
		userId: user?.id,
		email: user?.email,
	});

	if (!account || !user) {
		console.log(
			"[handleSignIn] Missing account or user, allowing with fallback",
		);
		return true; // Allow sign-in with fallback
	}

	const userService = new UserService();

	try {
		// Validate required user data from OAuth provider
		if (!user.id || !user.email || !user.name || !account.access_token) {
			console.log("[handleSignIn] Missing required user data", {
				hasId: !!user.id,
				hasEmail: !!user.email,
				hasName: !!user.name,
				hasAccessToken: !!account.access_token,
			});
			return true; // Allow sign-in with fallback
		}

		// Check if user already exists in DynamoDB
		const notionUserId = account.providerAccountId || user.id;
		console.log("[handleSignIn] Checking for existing user", { notionUserId });

		let dbUser = await userService.getUserByNotionId(notionUserId);

		// Calculate token expiration
		const tokenExpiresAt = account.expires_at
			? new Date(account.expires_at * 1000).toISOString()
			: new Date(Date.now() + 3600 * 1000).toISOString();

		const isNewUser = !dbUser;
		console.log("[handleSignIn] User status", {
			isNewUser,
			existingUserId: dbUser?.id,
		});

		if (!dbUser) {
			console.log("[handleSignIn] Creating new user in DynamoDB");
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

			console.log("[handleSignIn] New user created", {
				userId: dbUser.id,
			});

			// Mark as new user for client-side handling
			user.isNewUser = true;
		} else {
			console.log("[handleSignIn] Updating existing user tokens");
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
			console.log("[handleSignIn] Existing user updated", {
				userId: dbUser.id,
			});
		}

		// Handle workspace creation for new users
		if (isNewUser) {
			console.log("[handleSignIn] Handling new user workspace setup");
			await handleNewUserWorkspace(dbUser.id);
		}

		// Store the database user ID in the user object for JWT callback
		user.id = dbUser.id;
		console.log("[handleSignIn] Sign-in process completed successfully", {
			userId: dbUser.id,
			isNewUser,
		});
		return true;
	} catch (error) {
		console.error("[handleSignIn] Failed to save user to DynamoDB:", error);
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
	console.log("[handleNewUserWorkspace] Starting workspace setup", { userId });

	try {
		const workspaceService = new WorkspaceService();
		const existingWorkspaces = await workspaceService.listWorkspaces(userId);

		console.log("[handleNewUserWorkspace] Existing workspaces check", {
			count: existingWorkspaces.length,
			workspaceIds: existingWorkspaces.map((w) => w.id),
		});

		// Only create default workspace if no workspaces exist
		// (guest workspace transfer might have already created one)
		if (existingWorkspaces.length === 0) {
			console.log(
				"[handleNewUserWorkspace] Creating default workspace for new user",
			);
			const workspace = await workspaceService.createWorkspace(userId, {
				name: "My Tasks",
			});
			console.log("[handleNewUserWorkspace] Default workspace created", {
				workspaceId: workspace.id,
			});
		} else {
			console.log(
				"[handleNewUserWorkspace] Skipping default workspace creation - workspaces already exist (likely from guest migration)",
			);
		}
	} catch (workspaceError) {
		console.error(
			"[handleNewUserWorkspace] Failed to create default workspace:",
			workspaceError,
		);
		// Don't fail the sign-in process if workspace creation fails
	}
}
