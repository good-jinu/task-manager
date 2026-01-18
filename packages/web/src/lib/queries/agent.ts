import { createMutation, createQuery } from "@tanstack/svelte-query";
import { queryClient } from "./client.js";
import {
	type AgentExecutionRecord,
	type ExecuteTaskParams,
	type ExecuteTaskResponse,
	queryKeys,
} from "./types.js";

// Fetch all executions
async function fetchExecutions(): Promise<AgentExecutionRecord[]> {
	const response = await fetch("/api/agent/executions");

	if (!response.ok) {
		throw new Error(`Failed to fetch executions: ${response.statusText}`);
	}

	const data = await response.json();
	return data.executions || [];
}

// Fetch a single execution by ID
async function fetchExecution(
	executionId: string,
): Promise<AgentExecutionRecord> {
	const response = await fetch(`/api/agent/executions/${executionId}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch execution: ${response.statusText}`);
	}

	const data = await response.json();
	return data.execution;
}

// Execute a task (async - returns immediately with executionId)
async function executeTask(
	params: ExecuteTaskParams,
): Promise<ExecuteTaskResponse> {
	const response = await fetch("/api/agent/execute-task", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(params),
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.error || "Failed to execute task");
	}

	return response.json();
}

// Query hook for all executions
export function useExecutions() {
	return createQuery(() => ({
		queryKey: queryKeys.executions(),
		queryFn: fetchExecutions,
		staleTime: 10 * 1000, // 10 seconds
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
		refetchInterval: 10 * 1000, // Refetch every 10 seconds to catch new/updated executions
	}));
}

// Query hook for a single execution with polling
export function useExecution(executionId: string | undefined) {
	return createQuery(() => ({
		queryKey: queryKeys.execution(executionId ?? ""),
		queryFn: () => fetchExecution(executionId ?? ""),
		enabled: !!executionId,
		refetchInterval: (query) => {
			// Poll every 5 seconds if status is pending
			const data = query.state.data;
			return data?.status === "pending" ? 5000 : false;
		},
		staleTime: 0, // Always consider stale to enable polling
	}));
}

// Mutation hook for executing a task
export function useExecuteTask() {
	return createMutation(() => ({
		mutationFn: executeTask,
		onSuccess: () => {
			// Invalidate executions list to show the new execution
			queryClient.invalidateQueries({
				queryKey: queryKeys.executions(),
			});
		},
	}));
}

// Utility to refresh executions
export function refreshExecutions() {
	return queryClient.invalidateQueries({
		queryKey: queryKeys.executions(),
	});
}

// Utility to refresh a specific execution
export function refreshExecution(executionId: string) {
	return queryClient.invalidateQueries({
		queryKey: queryKeys.execution(executionId),
	});
}
