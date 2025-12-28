// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			getSession(): Promise<Session | null>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module "@auth/core/types" {
	interface Session {
		accessToken?: string;
		notionUserId?: string;
		user: {
			id: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
		};
	}
}
