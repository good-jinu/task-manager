import type { DefaultSession } from "@auth/sveltekit";

declare module "@auth/sveltekit" {
	interface Session {
		user: {
			id: string;
			isNewUser?: boolean;
		} & DefaultSession["user"];
	}

	interface User {
		isNewUser?: boolean;
	}
}
