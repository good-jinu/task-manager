import { QueryClient } from "@tanstack/svelte-query";

// Create a query client with sensible defaults
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Cache for 5 minutes by default
			staleTime: 5 * 60 * 1000,
			// Keep data in cache for 10 minutes
			gcTime: 10 * 60 * 1000,
			// Retry failed requests 3 times
			retry: 3,
			// Retry with exponential backoff
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
			// Refetch on window focus for fresh data
			refetchOnWindowFocus: true,
			// Don't refetch on reconnect by default (can be overridden per query)
			refetchOnReconnect: false,
		},
		mutations: {
			// Retry mutations once
			retry: 1,
		},
	},
});
