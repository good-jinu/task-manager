<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import { List } from "./icons";
import TaskItem from "./TaskItem.svelte";
import { Card } from "./ui";

interface Props {
	tasks: Task[];
	title?: string;
	showEmpty?: boolean;
}

let { tasks, title = "Tasks", showEmpty = true }: Props = $props();

let filteredTasks = $derived(tasks.filter((task) => !task.archived));
</script>

{#if filteredTasks.length > 0 || showEmpty}
	<Card class="p-4">
		<div class="flex items-center gap-2 mb-3">
			<List class="w-4 h-4 text-muted-foreground" />
			<h3 class="font-medium text-sm">{title}</h3>
			<span class="text-xs text-muted-foreground">({filteredTasks.length})</span>
		</div>
		
		{#if filteredTasks.length > 0}
			<div class="space-y-2 max-h-60 overflow-y-auto">
				{#each filteredTasks as task (task.id)}
					<TaskItem {task} compact />
				{/each}
			</div>
		{:else if showEmpty}
			<p class="text-sm text-muted-foreground">No tasks yet. Ask me to create some!</p>
		{/if}
	</Card>
{/if}