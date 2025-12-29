import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	// Just return empty data - the client will load everything via API calls
	return {};
};
