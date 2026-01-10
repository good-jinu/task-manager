/**
 * Task API utilities
 */

export async function createTask(workspaceId: string, title: string) {
	const response = await fetch("/api/tasks", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			workspaceId,
			title: title.trim(),
			status: "todo",
		}),
	});

	if (!response.ok) {
		throw new Error("Failed to create task");
	}

	return response.json();
}

export async function fetchTasks(workspaceId: string) {
	const response = await fetch(`/api/tasks?workspaceId=${workspaceId}`);

	if (!response.ok) {
		throw new Error("Failed to fetch tasks");
	}

	const result = await response.json();
	return result.success ? result.data.items : [];
}

export async function updateTask(taskId: string, updates: any) {
	const response = await fetch(`/api/tasks/${taskId}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(updates),
	});

	if (!response.ok) {
		throw new Error("Failed to update task");
	}

	return response.json();
}

export async function deleteTask(taskId: string) {
	const response = await fetch(`/api/tasks/${taskId}`, {
		method: "DELETE",
	});

	if (!response.ok) {
		throw new Error("Failed to delete task");
	}

	return response.json();
}
