import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	return {
		session: await locals.auth(),
	};
};
