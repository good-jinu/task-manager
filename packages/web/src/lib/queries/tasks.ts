import { createQuery } from "@tanstack/svelte-query";
import type { Task } from "@task-manager/db";
import { queryClient } from "./client.js";

// Fetch tasks for a workspace
async function fetchTasks(workspaceId: string): Promise<Task[]> {
	const response = await fetch(`/api/tasks?workspaceId=${workspaceId}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch tasks: ${response.statusText}`);
	}

	const result = await response.json();

	// Handle the nested response structure: { success, data: { items, total, cursor } }
	if (result.success && result.data) {
		return result.data.items || [];
	}

	// Fallback for direct items array
	return result.items || [];
}

// Query key factory for tasks
export const taskQueryKeys = {
	all: ["tasks"] as const,
	workspace: (workspaceId: string) => ["tasks", workspaceId] as const,
};

// Query hook for tasks
export function useTasks(workspaceId: string) {
	return createQuery(() => ({
		queryKey: taskQueryKeys.workspace(workspaceId),
		queryFn: () => fetchTasks(workspaceId),
		enabled: !!workspaceId,
		staleTime: 10 * 1000, // 10 seconds - tasks change frequently
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
	}));
}

// Utility to refresh tasks for a workspace
export function refreshTasks(workspaceId: string) {
	return queryClient.invalidateQueries({
		queryKey: taskQueryKeys.workspace(workspaceId),
	});
}

// Utility to refresh all tasks
export function refreshAllTasks() {
	return queryClient.invalidateQueries({
		queryKey: taskQueryKeys.all,
	});
}
