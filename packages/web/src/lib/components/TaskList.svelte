<script lang="ts">
import type {
	PaginatedResult,
	Task,
	TaskStatus,
} from "@notion-task-manager/db";
import { Task as TaskIcon } from "./icons";
import TaskItem from "./TaskItem.svelte";
import { EmptyState, LoadingSpinner } from "./ui";
import { cn } from "./utils";

interface Props {
	tasks: Task[];
	workspaceId?: string;
	loading?: boolean;
	hasMore?: boolean;
	onLoadMore?: () => Promise<void>;
	onTasksUpdate?: (tasks: Task[]) => void;
	onStatusChange?: (taskId: string, status: TaskStatus) => Promise<void>;
	onEdit?: (task: Task) => void;
	onDelete?: (taskId: string) => Promise<void>;
	emptyMessage?: string;
	class?: string;
}

let {
	tasks,
	workspaceId,
	loading = false,
	hasMore = false,
	onLoadMore,
	onTasksUpdate,
	onStatusChange,
	onEdit,
	onDelete,
	emptyMessage = "No tasks yet. Create your first task above!",
	class: className = "",
}: Props = $props();

let listElement: HTMLDivElement;
let isLoadingMore = $state(false);

// Intersection Observer for infinite scroll
let observer: IntersectionObserver | null = null;
let sentinelElement: HTMLDivElement | null = $state(null);

$effect(() => {
	if (typeof window === "undefined") return;

	// Clean up previous observer
	if (observer) {
		observer.disconnect();
	}

	// Set up intersection observer for infinite scroll
	if (hasMore && onLoadMore && sentinelElement) {
		observer = new IntersectionObserver(
			async (entries) => {
				const entry = entries[0];
				if (entry.isIntersecting && !isLoadingMore && !loading) {
					isLoadingMore = true;
					try {
						await onLoadMore();
					} finally {
						isLoadingMore = false;
					}
				}
			},
			{
				rootMargin: "100px", // Start loading 100px before the sentinel comes into view
			},
		);

		observer.observe(sentinelElement);
	}

	// Cleanup function
	return () => {
		if (observer) {
			observer.disconnect();
		}
	};
});

// Group tasks by status for better organization
const groupedTasks = $derived(() => {
	const groups = {
		todo: tasks.filter((t) => t.status === "todo" && !t.archived),
		"in-progress": tasks.filter(
			(t) => t.status === "in-progress" && !t.archived,
		),
		done: tasks.filter((t) => t.status === "done" && !t.archived),
		archived: tasks.filter((t) => t.archived || t.status === "archived"),
	};

	return groups;
});

const hasAnyTasks = $derived(tasks.length > 0);
const hasActiveTasks = $derived(
	groupedTasks().todo.length > 0 ||
		groupedTasks()["in-progress"].length > 0 ||
		groupedTasks().done.length > 0,
);
</script>

<div class={cn('space-y-4', className)} bind:this={listElement}>
	{#if loading && tasks.length === 0}
		<div class="flex justify-center py-8">
			<LoadingSpinner size="lg" />
		</div>
	{:else if !hasAnyTasks}
		<EmptyState
			icon="task"
			title="No tasks yet"
			description={emptyMessage}
		/>
	{:else}
		<!-- Active tasks (todo and in-progress) -->
		{#if groupedTasks().todo.length > 0 || groupedTasks()['in-progress'].length > 0}
			<div class="space-y-3">
				{#if groupedTasks()['in-progress'].length > 0}
					<div>
						<h3 class="text-sm font-medium text-foreground-secondary mb-2 px-1">In Progress</h3>
						<div class="space-y-2">
							{#each groupedTasks()['in-progress'] as task (task.id)}
								<TaskItem
									{task}
									{workspaceId}
									{onTasksUpdate}
								/>
							{/each}
						</div>
					</div>
				{/if}

				{#if groupedTasks().todo.length > 0}
					<div>
						<h3 class="text-sm font-medium text-foreground-secondary mb-2 px-1">To Do</h3>
						<div class="space-y-2">
							{#each groupedTasks().todo as task (task.id)}
								<TaskItem
									{task}
									{workspaceId}
									{onTasksUpdate}
								/>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Completed tasks -->
		{#if groupedTasks().done.length > 0}
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-foreground-secondary mb-2 px-1">Completed</h3>
				<div class="space-y-2">
					{#each groupedTasks().done as task (task.id)}
						<TaskItem
							{task}
							{workspaceId}
							{onTasksUpdate}
							class="opacity-75"
						/>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Archived tasks (usually hidden or in a separate view) -->
		{#if groupedTasks().archived.length > 0}
			<details class="space-y-3">
				<summary class="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground-secondary px-1">
					Archived ({groupedTasks().archived.length})
				</summary>
				<div class="space-y-2 ml-4">
					{#each groupedTasks().archived as task (task.id)}
						<TaskItem
							{task}
							{workspaceId}
							{onTasksUpdate}
							class="opacity-50"
						/>
					{/each}
				</div>
			</details>
		{/if}

		<!-- Infinite scroll sentinel -->
		{#if hasMore && onLoadMore}
			<div bind:this={sentinelElement} class="py-4">
				{#if isLoadingMore}
					<div class="flex justify-center">
						<LoadingSpinner />
					</div>
				{/if}
			</div>
		{/if}

		<!-- Loading indicator for initial load with existing tasks -->
		{#if loading && tasks.length > 0}
			<div class="flex justify-center py-4">
				<LoadingSpinner />
			</div>
		{/if}
	{/if}
</div>