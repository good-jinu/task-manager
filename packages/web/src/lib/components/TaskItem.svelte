<script lang="ts">
import type { Task, TaskStatus } from "@task-manager/db";
import { goto } from "$app/navigation";
import { refreshTasks } from "$lib/queries";
import { taskService } from "$lib/services/task-service";
import { Check, Edit, Plus, Trash2 } from "./icons";
import { Badge } from "./ui";
import { cn } from "./utils";

interface Props {
	task: Task;
	workspaceId?: string;
	isContextSelected?: boolean;
	onContextToggle?: (taskId: string) => void;
	compact?: boolean;
	class?: string;
}

let {
	task,
	workspaceId = "",
	isContextSelected = false,
	onContextToggle,
	compact = false,
	class: className = "",
}: Props = $props();

let isUpdating = $state(false);
let isEditing = $state(false);
let editTitle = $state("");

// Update editTitle when task changes
$effect(() => {
	editTitle = task.title;
});

async function handleStatusToggle() {
	if (isUpdating || !workspaceId) return;

	isUpdating = true;
	try {
		await taskService.toggleTaskStatus(task.id, task.status);
		// Refresh tasks using query invalidation
		refreshTasks(workspaceId);
	} catch (error) {
		console.error("Failed to update task:", error);
	} finally {
		isUpdating = false;
	}
}

async function handleDelete() {
	if (isUpdating || !workspaceId) return;

	isUpdating = true;
	try {
		await taskService.deleteTask(task.id);
		// Refresh tasks using query invalidation
		refreshTasks(workspaceId);
	} catch (error) {
		console.error("Failed to delete task:", error);
	} finally {
		isUpdating = false;
	}
}

async function handleEditSave() {
	if (!editTitle.trim() || isUpdating || !workspaceId) return;

	isUpdating = true;
	try {
		await taskService.updateTask(task.id, { title: editTitle.trim() });
		// Refresh tasks using query invalidation
		refreshTasks(workspaceId);
		isEditing = false;
	} catch (error) {
		console.error("Failed to update task:", error);
	} finally {
		isUpdating = false;
	}
}

function handleEditCancel() {
	editTitle = task.title;
	isEditing = false;
}

function handleEditKeydown(event: KeyboardEvent) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		handleEditSave();
	} else if (event.key === "Escape") {
		handleEditCancel();
	}
}

function handleContextToggle() {
	if (onContextToggle) {
		onContextToggle(task.id);
	}
}

function handleTaskClick(event: MouseEvent) {
	// Don't navigate if clicking on buttons or interactive elements
	const target = event.target as HTMLElement;
	if (target.closest("button") || target.closest("input")) {
		return;
	}

	goto(`/tasks/${task.id}`);
}

// Priority colors using semantic color system
const priorityColors = {
	low: "bg-info-alert-bg text-info",
	medium: "bg-warning-alert-bg text-warning-foreground",
	high: "bg-accent-icon-bg text-accent",
	urgent: "bg-error-alert-bg text-error",
};

// Status styles
const isCompleted = $derived(task.status === "done");
const isArchived = $derived(task.archived || task.status === "archived");
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
	class={cn(
		'relative bg-surface-base border rounded-lg overflow-hidden transition-all duration-200 cursor-pointer',
		isContextSelected ? 'border-accent bg-accent-icon-bg' : 'border-subtle-base hover:border-subtle-hover',
		className
	)}
	onclick={handleTaskClick}
	role="button"
	tabindex="0"
>
	<!-- Main task content -->
	<div class={cn(
		'flex items-center gap-3',
		compact ? 'p-2 min-h-[36px]' : 'p-4 min-h-[44px]'
	)}>
		<!-- Checkbox for task completion -->
		<button
			onclick={handleStatusToggle}
			disabled={isUpdating || isArchived}
			class={cn(
				'flex-shrink-0 rounded border-2 flex items-center justify-center',
				'transition-colors duration-200',
				compact ? 'w-4 h-4' : 'w-5 h-5',
				isCompleted 
					? 'bg-success border-success text-success-foreground' 
					: 'border-subtle-base hover:border-success',
				isArchived && 'opacity-50 cursor-not-allowed'
			)}
			aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
		>
			{#if isCompleted}
				<Check class={compact ? "w-2 h-2" : "w-3 h-3"} />
			{/if}
		</button>

		<!-- Task content -->
		<div class="flex-1 min-w-0">
			{#if isEditing}
				<input
					bind:value={editTitle}
					onkeydown={handleEditKeydown}
					class="w-full px-2 py-1 border border-subtle-base rounded focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent bg-surface-base text-foreground-base"
				/>
			{:else}
				<div class="flex items-start justify-between gap-2">
					<h3 class={cn(
						'leading-tight',
						compact ? 'text-sm font-medium' : 'font-medium text-foreground-base',
						isCompleted && 'line-through text-muted-foreground'
					)}>
						{task.title}
					</h3>
					
					{#if task.priority && !compact}
						<Badge 
							variant="secondary" 
							class={cn('text-xs', priorityColors[task.priority])}
						>
							{task.priority}
						</Badge>
					{/if}
				</div>

				{#if task.content && !compact}
					<p class={cn(
						'text-sm text-foreground-secondary line-clamp-2 mt-1',
						isCompleted && 'line-through text-muted-foreground'
					)}>
						{task.content}
					</p>
				{/if}

				{#if task.dueDate && !compact}
					<div class="mt-2 text-xs text-muted-foreground">
						Due: {new Date(task.dueDate).toLocaleDateString()}
					</div>
				{/if}

				<!-- Status indicator for non-todo/done states -->
				{#if task.status === 'in-progress' && !compact}
					<div class="mt-2">
						<Badge variant="secondary" class="bg-info-alert-bg text-info text-xs">
							In Progress
						</Badge>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Action buttons -->
		{#if workspaceId}
			<div class="flex items-center gap-2">
				{#if isEditing}
					<button
						onclick={handleEditSave}
						disabled={!editTitle.trim() || isUpdating}
						class="px-2 py-1 text-xs bg-success text-success-foreground rounded hover:bg-success-button-hover disabled:opacity-50"
					>
						Save
					</button>
					<button
						onclick={handleEditCancel}
						class="px-2 py-1 text-xs bg-subtle-base text-foreground-base rounded hover:bg-subtle-hover"
					>
						Cancel
					</button>
				{:else}
					<!-- Add to AI Context button -->
					<button
						onclick={handleContextToggle}
						class={cn(
							'p-1 rounded transition-colors',
							isContextSelected 
								? 'bg-accent text-accent-foreground' 
								: 'bg-surface-muted text-foreground-secondary hover:bg-subtle-hover'
						)}
						title="Add to AI context"
					>
						<Plus class="w-4 h-4" />
					</button>

					<!-- Edit button -->
					<button
						onclick={() => (isEditing = true)}
						class="p-1 bg-surface-muted text-foreground-secondary rounded hover:bg-subtle-hover transition-colors"
						title="Edit task"
					>
						<Edit class="w-4 h-4" />
					</button>

					<!-- Delete button -->
					<button
						onclick={handleDelete}
						disabled={isUpdating}
						class="p-1 bg-error-alert-bg text-error rounded hover:bg-error-button-hover transition-colors disabled:opacity-50"
						title="Delete task"
					>
						<Trash2 class="w-4 h-4" />
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>