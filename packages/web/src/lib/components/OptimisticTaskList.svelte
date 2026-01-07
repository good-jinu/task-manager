<script lang="ts">
import { onMount } from "svelte";
import {
	AlertCircle,
	Check,
	Clock,
	Trash2,
} from "$lib/components/icons/index.js";
import { Badge, Button, Card } from "$lib/components/ui/index.js";
import { isOnline } from "$lib/offline-sync.js";
import {
	optimisticTaskService,
	type Task,
} from "$lib/optimistic-task-service.js";
import OfflineIndicator from "./OfflineIndicator.svelte";

interface Props {
	workspaceId: string;
}

let { workspaceId }: Props = $props();

let tasks = $state<Task[]>([]);
let loading = $state(false);
let error = $state<string | null>(null);
let online = $derived($isOnline);

let newTaskTitle = $state("");
let isCreating = $state(false);

// Subscribe to service state
onMount(() => {
	const unsubscribeTasks = optimisticTaskService.tasks.subscribe((value) => {
		tasks = value;
	});

	const unsubscribeLoading = optimisticTaskService.loading.subscribe(
		(value) => {
			loading = value;
		},
	);

	const unsubscribeError = optimisticTaskService.error.subscribe((value) => {
		error = value;
	});

	optimisticTaskService.loadTasks(workspaceId);

	return () => {
		unsubscribeTasks();
		unsubscribeLoading();
		unsubscribeError();
	};
});

async function createTask() {
	if (!newTaskTitle.trim() || isCreating) return;

	isCreating = true;
	try {
		await optimisticTaskService.createTask({
			workspaceId,
			title: newTaskTitle.trim(),
		});
		newTaskTitle = "";
	} catch (error) {
		console.error("Failed to create task:", error);
	} finally {
		isCreating = false;
	}
}

async function toggleTask(task: Task) {
	try {
		await optimisticTaskService.toggleTaskStatus(task.id);
	} catch (error) {
		console.error("Failed to toggle task:", error);
	}
}

async function deleteTask(taskId: string) {
	try {
		await optimisticTaskService.deleteTask(taskId);
	} catch (error) {
		console.error("Failed to delete task:", error);
	}
}

function getSyncStatusBadge(syncStatus?: string) {
	switch (syncStatus) {
		case "pending":
			return {
				text: "Syncing",
				class: "bg-yellow-100 text-yellow-800",
				icon: Clock,
			};
		case "conflict":
			return {
				text: "Conflict",
				class: "bg-red-100 text-red-800",
				icon: AlertCircle,
			};
		case "synced":
			return {
				text: "Synced",
				class: "bg-green-100 text-green-800",
				icon: Check,
			};
		default:
			return null;
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Enter") {
		createTask();
	}
}
</script>

<div class="space-y-4">
	<!-- Offline Indicator -->
	<div class="flex justify-between items-center">
		<h2 class="text-lg font-semibold">Tasks</h2>
		<OfflineIndicator />
	</div>

	<!-- Task Input -->
	<Card class="p-4">
		<div class="flex gap-2">
			<input
				bind:value={newTaskTitle}
				onkeydown={handleKeydown}
				placeholder="What needs to be done?"
				disabled={isCreating}
				class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			/>
			<Button onclick={createTask} disabled={!newTaskTitle.trim() || isCreating}>
				{isCreating ? 'Adding...' : 'Add'}
			</Button>
		</div>
		
		{#if !online}
			<p class="text-sm text-orange-600 mt-2">
				You're offline. Tasks will sync when connection is restored.
			</p>
		{/if}
	</Card>

	<!-- Error Display -->
	{#if error}
		<Card class="p-4 bg-red-50 border-red-200">
			<p class="text-red-800 text-sm">{error}</p>
		</Card>
	{/if}

	<!-- Loading State -->
	{#if loading && tasks.length === 0}
		<Card class="p-8 text-center">
			<p class="text-gray-500">Loading tasks...</p>
		</Card>
	{/if}

	<!-- Task List -->
	<div class="space-y-2">
		{#each tasks as task (task.id)}
			<Card class="p-4 transition-all duration-200 hover:shadow-md">
				<div class="flex items-start gap-3">
					<!-- Task Toggle -->
					<button
						onclick={() => toggleTask(task)}
						class="mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
							{task.status === 'done' 
								? 'bg-green-500 border-green-500 text-white' 
								: 'border-gray-300 hover:border-green-400'}"
						aria-label={task.status === 'done' ? 'Mark as incomplete' : 'Mark as complete'}
					>
						{#if task.status === 'done'}
							<Check class="w-3 h-3" />
						{/if}
					</button>

					<!-- Task Content -->
					<div class="flex-1 min-w-0">
						<h3 class="font-medium text-sm {task.status === 'done' ? 'line-through text-gray-500' : ''}">
							{task.title}
						</h3>
						
						{#if task.content}
							<p class="text-xs text-gray-600 mt-1 {task.status === 'done' ? 'line-through' : ''}">
								{task.content}
							</p>
						{/if}

						<!-- Task Meta -->
						<div class="flex items-center gap-2 mt-2">
							{#if task.priority}
								<Badge variant="secondary" class="text-xs">
									{task.priority}
								</Badge>
							{/if}
							
							{#if task.dueDate}
								<Badge variant="secondary" class="text-xs">
									Due: {new Date(task.dueDate).toLocaleDateString()}
								</Badge>
							{/if}

							<!-- Sync Status -->
							{#if task.syncStatus && task.syncStatus !== 'synced'}
								{@const badge = getSyncStatusBadge(task.syncStatus)}
								{#if badge}
									<Badge class="text-xs {badge.class}">
										{@const IconComponent = badge.icon}
										<IconComponent class="w-2.5 h-2.5 mr-1" />
										{badge.text}
									</Badge>
								{/if}
							{/if}
						</div>
					</div>

					<!-- Delete Button -->
					<button
						onclick={() => deleteTask(task.id)}
						class="text-gray-400 hover:text-red-500 p-1 transition-colors"
						aria-label="Delete task"
					>
						<Trash2 class="w-3.5 h-3.5" />
					</button>
				</div>
			</Card>
		{/each}
	</div>

	<!-- Empty State -->
	{#if !loading && tasks.length === 0}
		<Card class="p-8 text-center">
			<p class="text-gray-500">No tasks yet. Add one above to get started!</p>
		</Card>
	{/if}
</div>