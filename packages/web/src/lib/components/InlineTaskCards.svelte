<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import { Plus } from "./icons";
import TaskItem from "./TaskItem.svelte";

interface Props {
	tasks: Task[];
}

let { tasks }: Props = $props();
</script>

{#if tasks && tasks.length > 0}
	<div class="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
		<div class="text-sm text-foreground-secondary mb-2 flex items-center gap-2">
			<Plus class="w-4 h-4" />
			New tasks created:
		</div>
		{#each tasks as task (task.id)}
			<div class="bg-gradient-to-r from-accent-icon-bg to-primary-icon-bg rounded-xl p-3 sm:p-4 shadow-sm">
				<TaskItem {task} />
			</div>
		{/each}
	</div>
{/if}