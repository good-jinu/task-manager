import type { RequestEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";

/**
 * Middleware function to protect routes that require authentication
 * @param event - SvelteKit request event
 * @returns session if authenticated, throws redirect if not
 */
export async function requireAuth(event: RequestEvent) {
	const session = await event.locals.getSession();

	if (!session?.user) {
		throw redirect(302, "/auth/signin");
	}

	return session;
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
