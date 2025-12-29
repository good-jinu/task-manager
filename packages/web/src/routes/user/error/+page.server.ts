import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	// Allow access to error page regardless of authentication status
	const session = await event.locals.auth();

	return {
		session,
	};
};
