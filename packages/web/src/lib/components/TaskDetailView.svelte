<script lang="ts">
import type { Task } from "@task-manager/db";
import { marked } from "marked";
import { ArrowLeft, Calendar, Clock, Edit, Flag, Save, Tag, X } from "./icons";

interface Props {
	task: Task;
	onTaskUpdate?: (task: Task) => void;
	onBack?: () => void;
}

let { task, onTaskUpdate, onBack }: Props = $props();

let isEditing = $state(false);
let editForm = $state({
	title: "",
	content: "",
	priority: "medium",
	status: "todo",
	dueDate: "",
});

// Update editForm when task changes
$effect(() => {
	editForm = {
		title: task.title,
		content: task.content || "",
		priority: task.priority || "medium",
		status: task.status,
		dueDate: task.dueDate || "",
	};
});

// Reactive markdown content
const markdownContent = $derived(
	task.content ? marked(task.content) : "<p>No description provided.</p>",
);

const priorityColors: Record<string, string> = {
	low: "text-info bg-info-alert-bg border-info-border",
	medium: "text-warning-foreground bg-warning-alert-bg border-warning-border",
	high: "text-accent bg-accent-icon-bg border-accent",
	urgent: "text-error-foreground bg-error-alert-bg border-error-border",
};

const statusColors: Record<string, string> = {
	todo: "text-muted-foreground bg-subtle-base border-subtle-base",
	in_progress: "text-info bg-info-alert-bg border-info-border",
	"in-progress": "text-info bg-info-alert-bg border-info-border", // Support both formats
	done: "text-success-foreground bg-success-alert-bg border-success-border",
	cancelled: "text-error-foreground bg-error-alert-bg border-error-border",
};

function startEditing() {
	editForm = {
		title: task.title,
		content: task.content || "",
		priority: task.priority || "medium",
		status: task.status,
		dueDate: task.dueDate || "",
	};
	isEditing = true;
}

function cancelEditing() {
	isEditing = false;
}

async function saveChanges() {
	try {
		const response = await fetch(`/api/tasks/${task.id}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(editForm),
		});

		if (response.ok) {
			const data = await response.json();
			onTaskUpdate?.(data.task);
			isEditing = false;
		} else {
			console.error("Failed to update task");
		}
	} catch (error) {
		console.error("Error updating task:", error);
	}
}

function formatDate(dateString: string) {
	return new Date(dateString).toLocaleDateString();
}
</script>

<div class="bg-surface-base rounded-lg shadow-sm border border-border-subtle">
	<!-- Header -->
	<div class="px-6 py-4 border-b border-border-subtle">
		<div class="flex items-center justify-between">
			<button
				onclick={onBack}
				class="flex items-center gap-2 text-muted-foreground hover:text-foreground-base transition-colors"
			>
				<ArrowLeft class="h-4 w-4" />
				<span>Back to Tasks</span>
			</button>
			
			<div class="flex items-center gap-2">
				{#if !isEditing}
					<button
						onclick={startEditing}
						class="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary-button-hover transition-colors"
					>
						<Edit class="h-4 w-4" />
						<span>Edit</span>
					</button>
				{:else}
					<button
						onclick={cancelEditing}
						class="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface-muted text-muted-foreground rounded-lg hover:bg-subtle-hover transition-colors"
					>
						<X class="h-4 w-4" />
						<span>Cancel</span>
					</button>
					<button
						onclick={saveChanges}
						class="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary-button-hover transition-colors"
					>
						<Save class="h-4 w-4" />
						<span>Save</span>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="px-6 py-6">
		{#if isEditing}
			<!-- Edit Form -->
			<div class="space-y-6">
				<!-- Title -->
				<div>
					<label for="task-title" class="block text-sm font-medium text-foreground-base mb-2">Title</label>
					<input
						id="task-title"
						bind:value={editForm.title}
						class="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
						placeholder="Task title"
					/>
				</div>

				<!-- Status and Priority -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="task-status" class="block text-sm font-medium text-foreground-base mb-2">Status</label>
						<select
							id="task-status"
							bind:value={editForm.status}
							class="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
						>
							<option value="todo">To Do</option>
							<option value="in_progress">In Progress</option>
							<option value="done">Done</option>
							<option value="cancelled">Cancelled</option>
						</select>
					</div>
					
					<div>
						<label for="task-priority" class="block text-sm font-medium text-foreground-base mb-2">Priority</label>
						<select
							id="task-priority"
							bind:value={editForm.priority}
							class="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
						>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="urgent">Urgent</option>
						</select>
					</div>
				</div>

				<!-- Due Date -->
				<div>
					<label for="task-due-date" class="block text-sm font-medium text-foreground-base mb-2">Due Date</label>
					<input
						id="task-due-date"
						type="date"
						bind:value={editForm.dueDate}
						class="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
					/>
				</div>

				<!-- Content -->
				<div>
					<label for="task-content" class="block text-sm font-medium text-foreground-base mb-2">Description (Markdown supported)</label>
					<textarea
						id="task-content"
						bind:value={editForm.content}
						rows="10"
						class="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
						placeholder="Task description in markdown..."
					></textarea>
				</div>
			</div>
		{:else}
			<!-- View Mode -->
			<div class="space-y-6">
				<!-- Title -->
				<h1 class="text-2xl font-bold text-foreground-base">{task.title}</h1>

				<!-- Metadata -->
				<div class="flex flex-wrap items-center gap-4">
					<!-- Status -->
					<div class="flex items-center gap-2">
						<Tag class="h-4 w-4 text-muted-foreground" />
						<span class={`px-2 py-1 text-xs font-medium rounded-full border ${statusColors[task.status]}`}>
							{task.status.replace('_', ' ').toUpperCase()}
						</span>
					</div>

					<!-- Priority -->
					{#if task.priority}
						<div class="flex items-center gap-2">
							<Flag class="h-4 w-4 text-muted-foreground" />
							<span class={`px-2 py-1 text-xs font-medium rounded-full border ${priorityColors[task.priority]}`}>
								{task.priority.toUpperCase()}
							</span>
						</div>
					{/if}

					<!-- Due Date -->
					{#if task.dueDate}
						<div class="flex items-center gap-2">
							<Calendar class="h-4 w-4 text-muted-foreground" />
							<span class="text-sm text-muted-foreground">
								Due {formatDate(task.dueDate)}
							</span>
						</div>
					{/if}

					<!-- Created Date -->
					<div class="flex items-center gap-2">
						<Clock class="h-4 w-4 text-muted-foreground" />
						<span class="text-sm text-muted-foreground">
							Created {formatDate(task.createdAt)}
						</span>
					</div>
				</div>

				<!-- Content -->
				<div class="prose prose-sm max-w-none">
					<div class="bg-surface-muted rounded-lg p-4 border border-subtle-base">
						{@html markdownContent}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>