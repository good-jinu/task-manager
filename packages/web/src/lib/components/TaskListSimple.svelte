<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import { Spinner, Task as TaskIcon } from "./icons";

let {
	tasks = [],
	loading = false,
	ontaskupdated,
	ontaskdeleted,
	onerror,
}: {
	tasks: Task[];
	loading?: boolean;
	ontaskupdated?: (task: Task) => void;
	ontaskdeleted?: (taskId: string) => void;
	onerror?: (error: string) => void;
} = $props();

async function handleStatusChange(taskId: string, newStatus: string) {
	try {
		const response = await fetch(`/api/tasks/${taskId}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ status: newStatus }),
		});

		const data = await response.json();

		if (response.ok) {
			ontaskupdated?.(data.task);
		} else {
			onerror?.(data.error || "Failed to update task");
		}
	} catch (err) {
		onerror?.("Failed to update task");
		console.error("Error updating task:", err);
	}
}

async function handleDelete(taskId: string) {
	if (!confirm("Are you sure you want to delete this task?")) return;

	try {
		const response = await fetch(`/api/tasks/${taskId}`, {
			method: "DELETE",
		});

		if (response.ok) {
			ontaskdeleted?.(taskId);
		} else {
			const data = await response.json();
			onerror?.(data.error || "Failed to delete task");
		}
	} catch (err) {
		onerror?.("Failed to delete task");
		console.error("Error deleting task:", err);
	}
}

function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString();
}

function getPriorityColor(priority: string): string {
	switch (priority) {
		case "urgent":
			return "text-error border-error bg-error/10";
		case "high":
			return "text-warning border-warning bg-warning/10";
		case "medium":
			return "text-primary border-primary bg-primary/10";
		case "low":
			return "text-foreground-secondary border-subtle-base bg-surface-muted";
		default:
			return "text-foreground-secondary border-subtle-base bg-surface-muted";
	}
}

function getStatusColor(status: string): string {
	switch (status) {
		case "done":
			return "text-success border-success bg-success/10";
		case "in-progress":
			return "text-accent border-accent bg-accent/10";
		case "todo":
			return "text-foreground-secondary border-subtle-base bg-surface-muted";
		default:
			return "text-foreground-secondary border-subtle-base bg-surface-muted";
	}
}
</script>

<div class="bg-card-bg border border-subtle-base rounded-xl">
	<!-- Header -->
	<div class="px-4 py-3 border-b border-subtle-base">
		<h2 class="font-medium text-foreground-base flex items-center gap-2">
			<TaskIcon class="w-5 h-5" />
			Tasks
			{#if tasks.length > 0}
				<span class="text-sm text-foreground-secondary">({tasks.length})</span>
			{/if}
		</h2>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Spinner class="w-6 h-6 text-primary mr-3" />
			<span class="text-foreground-secondary">Loading tasks...</span>
		</div>
	{:else if tasks.length === 0}
		<!-- Empty State -->
		<div class="text-center py-12 px-4">
			<TaskIcon class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
			<h3 class="text-lg font-medium text-foreground-base mb-2">No tasks yet</h3>
			<p class="text-foreground-secondary text-sm">Create your first task above to get started!</p>
		</div>
	{:else}
		<!-- Task List -->
		<div class="divide-y divide-subtle-base">
			{#each tasks as task (task.id)}
				<div class="p-4 hover:bg-surface-raised transition-colors">
					<!-- Task Header -->
					<div class="flex items-start justify-between gap-3 mb-2">
						<div class="flex-1 min-w-0">
							<h3 class="font-medium text-foreground-base truncate">{task.title}</h3>
							{#if task.content}
								<p class="text-sm text-foreground-secondary mt-1 line-clamp-2">{task.content}</p>
							{/if}
						</div>
						
						<!-- Status Dropdown -->
						<select
							value={task.status}
							onchange={(e) => handleStatusChange(task.id, e.currentTarget.value)}
							class="px-2 py-1 text-xs border rounded {getStatusColor(task.status)} focus:outline-none focus:ring-2 focus:ring-primary"
						>
							<option value="todo">To Do</option>
							<option value="in-progress">In Progress</option>
							<option value="done">Done</option>
						</select>
					</div>

					<!-- Task Meta -->
					<div class="flex items-center justify-between text-xs text-foreground-secondary">
						<div class="flex items-center gap-3">
							{#if task.priority && task.priority !== 'medium'}
								<span class="px-2 py-1 rounded border {getPriorityColor(task.priority)}">
									{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
								</span>
							{/if}
							
							{#if task.dueDate}
								<span class="flex items-center gap-1">
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									Due {formatDate(task.dueDate)}
								</span>
							{/if}
						</div>

						<!-- Actions -->
						<div class="flex items-center gap-2">
							<span class="text-xs">
								Created {formatDate(task.createdAt)}
							</span>
							<button
								onclick={() => handleDelete(task.id)}
								class="text-error hover:text-error-button-hover p-1 rounded transition-colors"
								title="Delete task"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>