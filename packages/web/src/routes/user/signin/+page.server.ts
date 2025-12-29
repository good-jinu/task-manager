import { redirectIfAuthenticated } from "$lib/auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	// Redirect to tasks if already authenticated
	await redirectIfAuthenticated(event, "/tasks");

	return {};
};
