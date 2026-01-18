<script lang="ts">
import type { Task } from "@task-manager/db";
import { refreshTasks, useTasks } from "$lib/queries";
import { taskService } from "$lib/services/task-service";
import { Plus } from "./icons";
import TaskItem from "./TaskItem.svelte";

interface Props {
	workspaceId: string;
	selectedContextTasks?: Set<string>;
	onContextToggle?: (taskId: string) => void;
}

let {
	workspaceId,
	selectedContextTasks = new Set(),
	onContextToggle,
}: Props = $props();

// Use tasks query - make it reactive to workspaceId changes
let tasksQuery = $derived(useTasks(workspaceId));
const tasks = $derived(tasksQuery.data || []);

let isCreatingTask = $state(false);
let newTaskTitle = $state("");

async function handleAddTask() {
	if (!newTaskTitle.trim()) return;

	try {
		await taskService.createTask({
			workspaceId,
			title: newTaskTitle,
		});
		// Refresh tasks using query invalidation
		refreshTasks(workspaceId);
		resetTaskCreation();
	} catch (error) {
		console.error("Failed to create task:", error);
	}
}

function resetTaskCreation() {
	newTaskTitle = "";
	isCreatingTask = false;
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		handleAddTask();
	} else if (event.key === "Escape") {
		resetTaskCreation();
	}
}
</script>

<div class="flex flex-col h-full bg-surface-base">
	<!-- Header with Add Button -->
	<div class="flex items-center justify-between p-4 border-b border-subtle-base">
		<h1 class="text-2xl font-semibold text-foreground-base">Tasks</h1>
		<button
			onclick={() => (isCreatingTask = true)}
			class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-button-hover transition-colors"
		>
			<Plus class="w-4 h-4" />
			Add Task
		</button>
	</div>

	<!-- Task Creation Input -->
	{#if isCreatingTask}
		<div class="p-4 border-b border-subtle-base bg-background-alt">
			<input
				bind:value={newTaskTitle}
				onkeydown={handleKeydown}
				placeholder="Enter task title..."
				class="w-full px-3 py-2 border border-subtle-base rounded-lg focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent bg-surface-base text-foreground-base placeholder-muted-foreground"
			/>
			<div class="flex gap-2 mt-2">
				<button
					onclick={handleAddTask}
					disabled={!newTaskTitle.trim()}
					class="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary-button-hover disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Add
				</button>
				<button
					onclick={resetTaskCreation}
					class="px-3 py-1 text-sm bg-subtle-base text-foreground-base rounded hover:bg-subtle-hover"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Tasks List -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if tasksQuery.isLoading}
			<div class="text-center py-12 text-muted-foreground">
				<p class="text-lg">Loading tasks...</p>
			</div>
		{:else if tasksQuery.isError}
			<div class="text-center py-12 text-error">
				<p class="text-lg">Failed to load tasks</p>
				<p class="text-sm">{tasksQuery.error?.message}</p>
			</div>
		{:else if tasks.length === 0}
			<div class="text-center py-12 text-muted-foreground">
				<p class="text-lg">No tasks yet</p>
				<p class="text-sm">Click "Add Task" to create your first task</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each tasks as task (task.id)}
					<TaskItem
						{task}
						{workspaceId}
						isContextSelected={selectedContextTasks.has(task.id)}
						{onContextToggle}
					/>
				{/each}
			</div>
		{/if}
	</div>
</div>