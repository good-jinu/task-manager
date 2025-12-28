import { requireAuth } from "$lib/auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	// Ensure user is authenticated
	const session = await requireAuth(event);

	return {
		session,
	};
};
