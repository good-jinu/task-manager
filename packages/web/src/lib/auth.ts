import type { RequestEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";

/**
 * Middleware function to protect routes that require authentication
 * @param event - SvelteKit request event
 * @returns session if authenticated, throws redirect if not
 */
export async function requireAuth(event: RequestEvent) {
	const session = await event.locals.auth();

	if (!session?.user || !session.user.id) {
		throw redirect(302, "/");
	}

	return {
		user: {
			id: session.user.id,
			email: session.user.email,
			image: session.user.image,
			name: session.user.name,
		},
		expires: session.expires,
	};
}

/**
 * Middleware function to redirect authenticated users away from auth pages
 * @param event - SvelteKit request event
 * @param redirectTo - Where to redirect authenticated users (default: '/')
 */
export async function redirectIfAuthenticated(
	event: RequestEvent,
	redirectTo: string = "/",
) {
	const session = await event.locals.getSession();

	if (session?.user) {
		throw redirect(302, redirectTo);
	}

	return session;
}
