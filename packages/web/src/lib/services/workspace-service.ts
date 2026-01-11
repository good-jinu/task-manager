import type { Workspace } from "@notion-task-manager/db";

/**
 * Load all workspaces for the current user
 */
export async function loadWorkspaces(): Promise<Workspace[]> {
	const response = await fetch("/api/workspaces");
	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error || "Failed to load workspaces");
	}

	return data.workspaces || [];
}

/**
 * Create a new workspace
 */
export async function createWorkspace(
	name: string,
	description?: string,
): Promise<Workspace> {
	const response = await fetch("/api/workspaces", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			name,
			description,
		}),
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error || "Failed to create workspace");
	}

	return data.data;
}

/**
 * Create a default workspace for new users
 */
export async function createDefaultWorkspace(): Promise<Workspace> {
	return createWorkspace("My Tasks");
}
