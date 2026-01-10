<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { ErrorAlert, LoadingSpinner } from "$lib/components";
import TaskDetailView from "$lib/components/TaskDetailView.svelte";
import TopMenu from "$lib/components/TopMenu.svelte";

let task: Task | null = $state(null);
let loading = $state(true);
let error = $state("");

const taskId = $derived($page.params.id);

onMount(async () => {
	await loadTask();
});

async function loadTask() {
	if (!taskId) return;

	loading = true;
	error = "";

	try {
		const response = await fetch(`/api/tasks/${taskId}`);
		const data = await response.json();

		if (response.ok) {
			task = data.task;
		} else {
			error = data.error || "Failed to load task";
		}
	} catch (err) {
		error = "Failed to load task";
		console.error("Error loading task:", err);
	} finally {
		loading = false;
	}
}

async function handleTaskUpdate(updatedTask: Task) {
	task = updatedTask;
}

function handleBack() {
	goto("/");
}

function handleMenuAction(action: string) {
	switch (action) {
		case "home":
			goto("/");
			break;
		case "settings":
			// TODO: Implement settings
			break;
		default:
			console.log("Menu action:", action);
	}
}
</script>

<svelte:head>
	<title>{task ? `${task.title} - TaskFlow` : "Task - TaskFlow"}</title>
	<meta name="description" content="View and edit task details" />
</svelte:head>

<div class="min-h-screen bg-page-bg">
	<!-- Top Menu -->
	<TopMenu onMenuAction={handleMenuAction} />
	
	<!-- Main Content -->
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
		{#if loading}
			<LoadingSpinner text="Loading task..." />
		{:else if error}
			<ErrorAlert {error} />
		{:else if task}
			<TaskDetailView {task} onTaskUpdate={handleTaskUpdate} onBack={handleBack} />
		{:else}
			<div class="text-center py-12">
				<p class="text-muted-foreground">Task not found</p>
				<button 
					onclick={handleBack}
					class="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-button-hover"
				>
					Back to Tasks
				</button>
			</div>
		{/if}
	</div>
</div>