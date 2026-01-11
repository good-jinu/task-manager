import { SvelteKitAuth } from "@auth/sveltekit";
import { createAuthConfig } from "$lib/server";
import "$lib/types/auth"; // Import auth type extensions

// Create auth configuration using the modular service
const authConfig = createAuthConfig();

// Initialize SvelteKit Auth with the configuration
const { handle: authHandle, signIn, signOut } = SvelteKitAuth(authConfig);

// Use only auth handler
export const handle = authHandle;
export { signIn, signOut };
