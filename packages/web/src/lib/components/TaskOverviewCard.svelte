<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import { CheckCircle, List, Plus } from "./icons";
import TaskItem from "./TaskItem.svelte";
import TaskStatistics from "./TaskStatistics.svelte";

interface Props {
	tasks: Task[];
	showDetails?: boolean;
	onToggleDetails?: () => void;
}

let { tasks, showDetails = false, onToggleDetails }: Props = $props();

// Derived state for task statistics
let activeTasks = $derived(
	tasks.filter((task) => task.status !== "done" && !task.archived),
);
let completedTasks = $derived(
	tasks.filter((task) => task.status === "done" && !task.archived),
);
let taskStats = $derived({
	total: tasks.filter((task) => !task.archived).length,
	active: activeTasks.length,
	completed: completedTasks.length,
});
</script>

<div class="bg-surface-raised rounded-2xl p-4 sm:p-6 shadow-sm">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
		<div class="flex items-center gap-3">
			<div class="w-10 h-10 sm:w-12 sm:h-12 bg-primary-icon-bg rounded-xl flex items-center justify-center">
				<List class="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
			</div>
			<div>
				<h3 class="text-lg sm:text-xl font-semibold text-foreground-base">Task Overview</h3>
				<p class="text-sm text-foreground-secondary">Your current workspace</p>
			</div>
		</div>
		{#if onToggleDetails}
			<button
				onclick={onToggleDetails}
				class="text-sm text-primary hover:text-primary-button-hover transition-colors px-3 py-1.5 rounded-lg hover:bg-primary-icon-bg self-start sm:self-auto"
			>
				{showDetails ? 'Hide Details' : 'Show Details'}
			</button>
		{/if}
	</div>

	<!-- Task Statistics -->
	<div class="mb-4 sm:mb-6">
		<TaskStatistics 
			total={taskStats.total} 
			active={taskStats.active} 
			completed={taskStats.completed} 
		/>
	</div>

	<!-- Expandable Task List -->
	{#if showDetails}
		<div class="space-y-3 sm:space-y-4 animate-in slide-in-from-top-2 duration-200">
			{#if activeTasks.length > 0}
				<div>
					<h4 class="text-sm font-medium text-foreground-base mb-2 sm:mb-3 flex items-center gap-2">
						<Plus class="w-4 h-4 text-warning" />
						Active Tasks ({activeTasks.length})
					</h4>
					<div class="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
						{#each activeTasks as task (task.id)}
							<div class="bg-surface-base rounded-lg p-3 sm:p-4">
								<TaskItem {task} compact />
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if completedTasks.length > 0}
				<div>
					<h4 class="text-sm font-medium text-foreground-base mb-2 sm:mb-3 flex items-center gap-2">
						<CheckCircle class="w-4 h-4 text-success" />
						Completed Tasks ({completedTasks.length})
					</h4>
					<div class="space-y-2 max-h-32 sm:max-h-48 overflow-y-auto">
						{#each completedTasks.slice(0, 3) as task (task.id)}
							<div class="bg-surface-base rounded-lg p-3 sm:p-4 opacity-75">
								<TaskItem {task} compact />
							</div>
						{/each}
						{#if completedTasks.length > 3}
							<div class="text-xs text-foreground-secondary text-center py-2">
								And {completedTasks.length - 3} more completed tasks...
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>