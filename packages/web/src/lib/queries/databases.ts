import { createQuery } from "@tanstack/svelte-query";
import {
	type DatabasesResponse,
	type NotionDatabase,
	queryKeys,
} from "./types.js";

// Fetch databases for a workspace
async function fetchDatabases(workspaceId: string): Promise<NotionDatabase[]> {
	const response = await fetch(
		`/api/integrations/notion/databases?workspaceId=${workspaceId}`,
	);

	if (!response.ok) {
		throw new Error(`Failed to fetch databases: ${response.statusText}`);
	}

	const data: DatabasesResponse = await response.json();

	// Transform the data to ensure compatibility
	return data.databases.map((db) => ({
		...db,
		title: db.title || db.name, // Ensure both name and title are available
		name: db.name || db.title,
	}));
}

// Query hook for databases
export function useDatabases(workspaceId: string) {
	return createQuery(() => ({
		queryKey: queryKeys.databases(workspaceId),
		queryFn: () => fetchDatabases(workspaceId),
		enabled: !!workspaceId,
		staleTime: 5 * 60 * 1000, // 5 minutes - databases don't change often
		gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
	}));
}

// Prefetch databases (useful for preloading)
export function prefetchDatabases(workspaceId: string) {
	return {
		queryKey: queryKeys.databases(workspaceId),
		queryFn: () => fetchDatabases(workspaceId),
	};
}
