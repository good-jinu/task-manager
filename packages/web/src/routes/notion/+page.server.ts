import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	// Redirect to login if not authenticated - Notion integration requires auth
	if (!session?.user) {
		throw redirect(302, "/user/signin?redirect=/notion");
	}

	return {
		session,
	};
};
