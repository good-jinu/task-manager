<script lang="ts">
	import { TaskStatus, TaskPriority } from '$lib/notion';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let error = $derived(form?.error || '');

	function getStatusColor(status: TaskStatus): string {
		switch (status) {
			case TaskStatus.TODO:
				return 'bg-gray-100 text-gray-800';
			case TaskStatus.IN_PROGRESS:
				return 'bg-blue-100 text-blue-800';
			case TaskStatus.DONE:
				return 'bg-green-100 text-green-800';
			case TaskStatus.CANCELLED:
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function getPriorityColor(priority?: TaskPriority): string {
		switch (priority) {
			case TaskPriority.LOW:
				return 'bg-green-100 text-green-800';
			case TaskPriority.MEDIUM:
				return 'bg-yellow-100 text-yellow-800';
			case TaskPriority.HIGH:
				return 'bg-orange-100 text-orange-800';
			case TaskPriority.URGENT:
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}
</script>

<svelte:head>
	<title>Task Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-8">Notion Task Manager</h1>

	{#if error}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
			{error}
		</div>
	{/if}

	{#if form?.success}
		<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
			Task operation completed successfully!
		</div>
	{/if}

	<!-- Create Task Form -->
	<div class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
		<h2 class="text-xl font-semibold mb-4">Create New Task</h2>
		
		<form method="POST" action="?/create" use:enhance class="space-y-4">
			<div>
				<label class="block text-gray-700 text-sm font-bold mb-2" for="title">
					Title *
				</label>
				<input
					id="title"
					name="title"
					type="text"
					required
					class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
				/>
			</div>

			<div>
				<label class="block text-gray-700 text-sm font-bold mb-2" for="description">
					Description
				</label>
				<textarea
					id="description"
					name="description"
					class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
					rows="3"
				></textarea>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label class="block text-gray-700 text-sm font-bold mb-2" for="status">
						Status
					</label>
					<select
						id="status"
						name="status"
						class="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
					>
						{#each Object.values(TaskStatus) as status}
							<option value={status}>{status}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-gray-700 text-sm font-bold mb-2" for="priority">
						Priority
					</label>
					<select
						id="priority"
						name="priority"
						class="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
					>
						{#each Object.values(TaskPriority) as priority}
							<option value={priority}>{priority}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-gray-700 text-sm font-bold mb-2" for="dueDate">
						Due Date
					</label>
					<input
						id="dueDate"
						name="dueDate"
						type="date"
						class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
					/>
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label class="block text-gray-700 text-sm font-bold mb-2" for="assignee">
						Assignee
					</label>
					<input
						id="assignee"
						name="assignee"
						type="text"
						class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
					/>
				</div>

				<div>
					<label class="block text-gray-700 text-sm font-bold mb-2" for="tags">
						Tags (comma-separated)
					</label>
					<input
						id="tags"
						name="tags"
						type="text"
						placeholder="urgent, documentation, feature"
						class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
					/>
				</div>
			</div>

			<button
				type="submit"
				class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
			>
				Create Task
			</button>
		</form>
	</div>

	<!-- Tasks List -->
	<div class="bg-white shadow-md rounded px-8 pt-6 pb-8">
		<h2 class="text-xl font-semibold mb-4">Tasks</h2>

		{#if data.tasks.length === 0}
			<p class="text-gray-600">No tasks found. Create your first task above!</p>
		{:else}
			<div class="space-y-4">
				{#each data.tasks as task (task.id)}
					<div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
						<div class="flex justify-between items-start mb-2">
							<h3 class="text-lg font-semibold">{task.title}</h3>
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="taskId" value={task.id} />
								<button
									type="submit"
									onclick={(e) => {
										if (!confirm('Are you sure you want to delete this task?')) {
											e.preventDefault();
										}
									}}
									class="text-red-600 hover:text-red-800 text-sm"
								>
									Delete
								</button>
							</form>
						</div>

						{#if task.description}
							<p class="text-gray-600 mb-3">{task.description}</p>
						{/if}

						<div class="flex flex-wrap gap-2 mb-3">
							<span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(task.status)}">
								{task.status}
							</span>

							{#if task.priority}
								<span class="px-2 py-1 rounded-full text-xs font-medium {getPriorityColor(task.priority)}">
									{task.priority}
								</span>
							{/if}

							{#if task.tags && task.tags.length > 0}
								{#each task.tags as tag}
									<span class="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
										{tag}
									</span>
								{/each}
							{/if}
						</div>

						<div class="flex justify-between items-center text-sm text-gray-500">
							<div>
								{#if task.assignee}
									<span>Assigned to: {task.assignee}</span>
								{/if}
								{#if task.dueDate}
									<span class="ml-4">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
								{/if}
							</div>

							<div class="flex gap-2">
								{#if task.status !== TaskStatus.DONE}
									<form method="POST" action="?/updateStatus" use:enhance class="inline">
										<input type="hidden" name="taskId" value={task.id} />
										<input type="hidden" name="status" value={TaskStatus.DONE} />
										<button
											type="submit"
											class="bg-green-500 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
										>
											Mark Done
										</button>
									</form>
								{/if}

								{#if task.status !== TaskStatus.IN_PROGRESS && task.status !== TaskStatus.DONE}
									<form method="POST" action="?/updateStatus" use:enhance class="inline">
										<input type="hidden" name="taskId" value={task.id} />
										<input type="hidden" name="status" value={TaskStatus.IN_PROGRESS} />
										<button
											type="submit"
											class="bg-blue-500 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
										>
											Start
										</button>
									</form>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>