import { createMutation, createQuery } from "@tanstack/svelte-query";
import { queryClient } from "./client.js";
import {
	type Integration,
	queryKeys,
	type WorkspaceIntegrationData,
} from "./types.js";

// Fetch integrations for a workspace
async function fetchIntegrations(
	workspaceId: string,
): Promise<WorkspaceIntegrationData[]> {
	const response = await fetch(
		`/api/integrations/status?workspaceId=${workspaceId}`,
	);

	if (!response.ok) {
		throw new Error(`Failed to fetch integrations: ${response.statusText}`);
	}

	const data = await response.json();
	return data.integrations;
}

// Toggle integration sync
async function toggleIntegration(params: {
	integrationId?: string;
	workspaceId: string;
	provider: string;
	enabled: boolean;
}): Promise<Integration> {
	const { integrationId, workspaceId, provider, enabled } = params;

	if (integrationId) {
		// Update existing integration
		const response = await fetch(`/api/integrations/${integrationId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ syncEnabled: enabled }),
		});

		if (!response.ok) {
			throw new Error(`Failed to update integration: ${response.statusText}`);
		}

		return response.json();
	} else {
		// Create new integration (OAuth flow)
		const response = await fetch("/api/integrations/notion/oauth", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ workspaceId }),
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to initiate OAuth");
		}

		const data = await response.json();
		// Redirect to OAuth URL
		window.location.href = data.authUrl;

		// Return a placeholder - the page will redirect
		return {} as Integration;
	}
}

// Connect to a specific database
async function connectDatabase(params: {
	workspaceId: string;
	databaseId: string;
	databaseName: string;
	importExisting: boolean;
}): Promise<Integration> {
	const response = await fetch("/api/integrations", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			workspaceId: params.workspaceId,
			provider: "notion",
			externalId: params.databaseId,
			config: {
				databaseId: params.databaseId,
				databaseName: params.databaseName,
				importExisting: params.importExisting,
			},
			syncEnabled: true,
		}),
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.error || "Failed to connect database");
	}

	return response.json();
}

// Disconnect integration
async function disconnectIntegration(integrationId: string): Promise<void> {
	const response = await fetch(`/api/integrations/${integrationId}`, {
		method: "DELETE",
	});

	if (!response.ok) {
		throw new Error(`Failed to disconnect integration: ${response.statusText}`);
	}
}

// Query hook for workspace integrations
export function useIntegrations(workspaceId: string) {
	return createQuery(() => ({
		queryKey: queryKeys.integrations(workspaceId),
		queryFn: () => fetchIntegrations(workspaceId),
		enabled: !!workspaceId,
		staleTime: 30 * 1000, // 30 seconds - integration status changes frequently
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
		refetchInterval: 30 * 1000, // Refetch every 30 seconds for live updates
	}));
}

// Mutation hook for toggling integration
export function useToggleIntegration(workspaceId: string) {
	return createMutation(() => ({
		mutationFn: toggleIntegration,
		onSuccess: () => {
			// Invalidate and refetch integrations
			queryClient.invalidateQueries({
				queryKey: queryKeys.integrations(workspaceId),
			});
		},
	}));
}

// Mutation hook for connecting database
export function useConnectDatabase(workspaceId: string) {
	return createMutation(() => ({
		mutationFn: connectDatabase,
		onSuccess: () => {
			// Invalidate and refetch integrations
			queryClient.invalidateQueries({
				queryKey: queryKeys.integrations(workspaceId),
			});
		},
	}));
}

// Mutation hook for disconnecting integration
export function useDisconnectIntegration(workspaceId: string) {
	return createMutation(() => ({
		mutationFn: disconnectIntegration,
		onSuccess: () => {
			// Invalidate and refetch integrations
			queryClient.invalidateQueries({
				queryKey: queryKeys.integrations(workspaceId),
			});
		},
	}));
}

// Utility to refresh integration status
export function refreshIntegrationStatus(workspaceId: string) {
	return queryClient.invalidateQueries({
		queryKey: queryKeys.integrations(workspaceId),
	});
}
