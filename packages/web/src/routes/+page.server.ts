import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	// Redirect authenticated users to tasks page
	if (session?.user) {
		throw redirect(302, "/tasks");
	}

	return {
		session,
	};
};
