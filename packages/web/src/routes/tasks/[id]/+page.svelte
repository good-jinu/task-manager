<script lang="ts">
import type { Task } from "@task-manager/db";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { ErrorAlert, LoadingSpinner } from "$lib/components";
import TaskDetailView from "$lib/components/TaskDetailView.svelte";
import TopMenu from "$lib/components/TopMenu.svelte";

let task: Task | null = $state(null);
let notionPageUrl: string | null = $state(null);
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
			notionPageUrl = data.notionPageUrl || null;
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
			// Navigate to home with settings drawer open
			goto("/?settings=true");
			break;
		case "signup":
			// Navigate to home with signup dialog open
			goto("/?signup=true");
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
			<!-- Notion Link Banner -->
			{#if notionPageUrl}
				<div class="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
					<div class="flex items-center gap-3">
						<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
							<path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
						</svg>
						<div>
							<p class="text-sm font-medium text-blue-900 dark:text-blue-100">
								Synced with Notion
							</p>
							<p class="text-xs text-blue-700 dark:text-blue-300">
								This task is linked to a Notion page
							</p>
						</div>
					</div>
					<a
						href={notionPageUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
					>
						Open in Notion
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
						</svg>
					</a>
				</div>
			{/if}
			
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