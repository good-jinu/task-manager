<script lang="ts">
import type { Task, TaskStatus } from "@notion-task-manager/db";
import { ArrowRightAlt, Check, Task as TaskIcon } from "./icons";
import { Badge } from "./ui";
import { cn } from "./utils";

interface Props {
	task: Task;
	onStatusChange?: (taskId: string, status: TaskStatus) => Promise<void>;
	onEdit?: (task: Task) => void;
	onDelete?: (taskId: string) => Promise<void>;
	compact?: boolean;
	class?: string;
}

let {
	task,
	onStatusChange,
	onEdit,
	onDelete,
	compact = false,
	class: className = "",
}: Props = $props();

let isUpdating = $state(false);
let swipeOffset = $state(0);
let isDragging = $state(false);
let startX = $state(0);

// Touch event handlers for swipe gestures
function handleTouchStart(e: TouchEvent) {
	startX = e.touches[0].clientX;
	isDragging = true;
}

function handleTouchMove(e: TouchEvent) {
	if (!isDragging) return;

	const currentX = e.touches[0].clientX;
	const diff = currentX - startX;

	// Only allow left swipe (negative offset)
	swipeOffset = Math.min(0, Math.max(-120, diff));
}

function handleTouchEnd() {
	isDragging = false;

	// If swiped more than 60px, show actions
	if (swipeOffset < -60) {
		swipeOffset = -120;
	} else {
		swipeOffset = 0;
	}
}

async function handleStatusToggle() {
	if (!onStatusChange || isUpdating) return;

	isUpdating = true;
	try {
		const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
		await onStatusChange(task.id, newStatus);
	} finally {
		isUpdating = false;
	}
}

async function handleDelete() {
	if (!onDelete || isUpdating) return;

	isUpdating = true;
	try {
		await onDelete(task.id);
	} finally {
		isUpdating = false;
	}
}

function handleEdit() {
	if (!onEdit) return;
	onEdit(task);
	swipeOffset = 0; // Close swipe actions
}

// Priority colors
const priorityColors = {
	low: "bg-blue-100 text-blue-800",
	medium: "bg-yellow-100 text-yellow-800",
	high: "bg-orange-100 text-orange-800",
	urgent: "bg-red-100 text-red-800",
};

// Status styles
const isCompleted = $derived(task.status === "done");
const isArchived = $derived(task.archived || task.status === "archived");
</script>

<div 
	class={cn(
		'relative bg-card border border-subtle-base rounded-lg overflow-hidden',
		'touch-pan-y select-none', // Enable touch scrolling but prevent text selection during swipe
		className
	)}
	style="transform: translateX({swipeOffset}px); transition: {isDragging ? 'none' : 'transform 0.2s ease-out'}"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
>
	<!-- Main task content -->
	<div class={cn(
		'flex items-start gap-3',
		compact ? 'p-2 min-h-[36px]' : 'p-4 min-h-[44px]'
	)}>
		<!-- Status toggle button -->
		<button
			onclick={handleStatusToggle}
			disabled={isUpdating || isArchived}
			class={cn(
				'flex-shrink-0 rounded-full border-2 flex items-center justify-center',
				'transition-colors duration-200 touch-manipulation',
				compact ? 'w-4 h-4 min-w-[32px] min-h-[32px] -m-1' : 'w-6 h-6 min-w-[44px] min-h-[44px] -m-2',
				isCompleted 
					? 'bg-green-500 border-green-500 text-white' 
					: 'border-subtle-base hover:border-green-400',
				isArchived && 'opacity-50 cursor-not-allowed'
			)}
			aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
		>
			{#if isCompleted}
				<Check class={compact ? "w-3 h-3" : "w-4 h-4"} />
			{/if}
		</button>

		<!-- Task content -->
		<div class="flex-1 min-w-0">
			<div class="flex items-start justify-between gap-2 mb-1">
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
					'text-sm text-foreground-secondary line-clamp-2',
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
					<Badge variant="secondary" class="bg-blue-100 text-blue-800 text-xs">
						In Progress
					</Badge>
				</div>
			{/if}
		</div>
	</div>

	<!-- Swipe actions (revealed when swiping left) -->
	<div class="absolute right-0 top-0 h-full flex items-center bg-surface-muted px-2 gap-2">
		{#if onEdit}
			<button
				onclick={handleEdit}
				class="bg-blue-500 text-white px-3 py-2 rounded-md text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
				aria-label="Edit task"
			>
				Edit
			</button>
		{/if}
		
		{#if onDelete}
			<button
				onclick={handleDelete}
				disabled={isUpdating}
				class="bg-red-500 text-white px-3 py-2 rounded-md text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
				aria-label="Delete task"
			>
				Delete
			</button>
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