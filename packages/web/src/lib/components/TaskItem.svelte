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
	low: "bg-info/10 text-info border-info/20",
	medium: "bg-warning/10 text-warning-foreground border-warning/20",
	high: "bg-accent/10 text-accent border-accent/20",
	urgent: "bg-error/10 text-error border-error/20",
};

// Status styles
const isCompleted = $derived(task.status === "done");
const isArchived = $derived(task.archived || task.status === "archived");
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
	class={cn(
		'group relative bg-surface-base border rounded-xl overflow-hidden transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md',
		isContextSelected ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : 'border-subtle-base hover:border-primary/30',
		isCompleted && 'opacity-75 hover:opacity-100 bg-surface-muted/30',
		className
	)}
	onclick={handleTaskClick}
	role="button"
	tabindex="0"
>
	<!-- Status accent line -->
	<div class={cn(
		"absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
		isCompleted ? "bg-success/40" : "bg-primary/0 group-hover:bg-primary/40",
		task.status === 'in-progress' && "bg-info"
	)}></div>

	<!-- Main task content -->
	<div class={cn(
		'flex items-start gap-4',
		compact ? 'p-3' : 'p-5'
	)}>
		<!-- Checkbox for task completion -->
		<button
			onclick={handleStatusToggle}
			disabled={isUpdating || isArchived}
			class={cn(
				'flex-shrink-0 mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 active:scale-90',
				isCompleted 
					? 'bg-success border-success text-success-foreground' 
					: 'bg-white border-subtle-base hover:border-success/50',
				isArchived && 'opacity-50 cursor-not-allowed'
			)}
			aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
		>
			{#if isCompleted}
				<Check class="w-3.5 h-3.5" />
			{/if}
		</button>

		<!-- Task content -->
		<div class="flex-1 min-w-0">
			{#if isEditing}
				<div class="flex flex-col gap-2">
					<input
						bind:value={editTitle}
						onkeydown={handleEditKeydown}
						class="w-full px-3 py-1.5 border border-primary/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface-base text-foreground-base font-medium"
					/>
					<div class="flex gap-2">
						<button
							onclick={handleEditSave}
							disabled={!editTitle.trim() || isUpdating}
							class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-lg font-bold hover:brightness-110 disabled:opacity-50"
						>
							Save
						</button>
						<button
							onclick={handleEditCancel}
							class="px-3 py-1 text-xs bg-surface-muted text-foreground-secondary rounded-lg font-bold hover:bg-subtle-base"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<div class="flex items-start justify-between gap-3">
					<h3 class={cn(
						'text-base leading-snug tracking-tight transition-all duration-300',
						compact ? 'text-sm font-semibold' : 'font-bold text-foreground-base',
						isCompleted && 'line-through text-muted-foreground'
					)}>
						{task.title}
					</h3>
					
					{#if task.priority && !compact}
						<Badge 
							variant="secondary" 
							class={cn('text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border', priorityColors[task.priority])}
						>
							{task.priority}
						</Badge>
					{/if}
				</div>

				{#if task.content && !compact}
					<p class={cn(
						'text-sm text-foreground-secondary line-clamp-2 mt-1.5 leading-relaxed',
						isCompleted && 'opacity-60'
					)}>
						{task.content}
					</p>
				{/if}

				<div class="flex flex-wrap items-center gap-3 mt-3">
					{#if task.dueDate && !compact}
						<div class="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
							<div class="w-1 h-1 rounded-full bg-muted-foreground/40"></div>
							{new Date(task.dueDate).toLocaleDateString()}
						</div>
					{/if}

					<!-- Status indicator for non-todo/done states -->
					{#if task.status === 'in-progress' && !compact}
						<Badge variant="secondary" class="bg-info/10 text-info text-[10px] font-bold uppercase tracking-wider border border-info/20">
							In Progress
						</Badge>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Action buttons (visible on hover) -->
		{#if workspaceId && !isEditing}
			<div class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
				<!-- Add to AI Context button -->
				<button
					onclick={handleContextToggle}
					class={cn(
						'p-1.5 rounded-lg transition-all duration-200 active:scale-95',
						isContextSelected
							? 'bg-accent text-accent-foreground'
							: 'bg-surface-muted text-foreground-secondary hover:bg-primary/10 hover:text-primary'
					)}
					title="Add to AI context"
				>
					<Plus class="w-4 h-4" />
				</button>

				<!-- Edit button -->
				<button
					onclick={() => (isEditing = true)}
					class="p-1.5 bg-surface-muted text-foreground-secondary rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200 active:scale-95"
					title="Edit task"
				>
					<Edit class="w-4 h-4" />
				</button>

				<!-- Delete button -->
				<button
					onclick={handleDelete}
					disabled={isUpdating}
					class="p-1.5 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-all duration-200 active:scale-95 disabled:opacity-50"
					title="Delete task"
				>
					<Trash2 class="w-4 h-4" />
				</button>
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