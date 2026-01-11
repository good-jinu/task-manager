import type { Account, User } from "@auth/sveltekit";

/**
 * Handle JWT token creation and updates
 */
export async function handleJWT(params: {
	token: any; // Using any since JWT type is not easily accessible
	user?: User;
	account?: Account | null;
}): Promise<any> {
	const { token, user, account } = params;

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
}
