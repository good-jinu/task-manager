import type { Session } from "@auth/sveltekit";

/**
 * Handle session creation and updates
 */
export async function handleSession(params: {
	session: Session;
	// biome-ignore lint/suspicious/noExplicitAny: any is neccessary
	token: any;
}): Promise<Session> {
	const { session, token } = params;

	// Pass user info and access token to session
	if (typeof token?.userId === "string") {
		session.user.id = token.userId;

		// Add additional user data to session
		if (typeof token.userEmail === "string") {
			session.user.email = token.userEmail;
		}
		if (typeof token.userName === "string") {
			session.user.name = token.userName;
		}
		if (typeof token.userImage === "string") {
			session.user.image = token.userImage;
		}
		if (typeof token.isNewUser === "boolean") {
			session.user.isNewUser = token.isNewUser;
		}
	}

	return session;
}
