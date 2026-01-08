<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import type { ChatMessage } from "../types/chat";
import ChatMessageComponent from "./ChatMessage.svelte";
import InlineTaskCards from "./InlineTaskCards.svelte";
import TaskOverviewCard from "./TaskOverviewCard.svelte";
import { EmptyState } from "./ui";

interface Props {
	messages: ChatMessage[];
	tasks: Task[];
	showTaskOverview: boolean;
	onToggleTaskOverview: () => void;
}

let { messages, tasks, showTaskOverview, onToggleTaskOverview }: Props =
	$props();

// Derived state for task statistics
let taskStats = $derived({
	total: tasks.filter((task) => !task.archived).length,
	active: tasks.filter((task) => task.status !== "done" && !task.archived)
		.length,
	completed: tasks.filter((task) => task.status === "done" && !task.archived)
		.length,
});
</script>

{#if messages.length === 0}
	<div class="h-full flex items-center justify-center">
		<EmptyState
			icon="task"
			title="Start a conversation"
			description="Ask me to create tasks, organize your work, or help with planning."
		/>
	</div>
{:else}
	<div class="max-w-5xl mx-auto space-y-4 sm:space-y-6">
		<!-- Task Overview Card - Appears as part of chat flow -->
		{#if taskStats.total > 0}
			<TaskOverviewCard 
				{tasks} 
				showDetails={showTaskOverview} 
				onToggleDetails={onToggleTaskOverview} 
			/>
		{/if}

		<!-- Chat Messages -->
		{#each messages as message (message.id)}
			<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
				<div class="max-w-full sm:max-w-3xl lg:max-w-4xl w-full">
					<ChatMessageComponent {message} />
					
					<!-- Task Cards - Appear inline with assistant messages -->
					<InlineTaskCards tasks={message.tasks || []} />
				</div>
			</div>
		{/each}
	</div>
{/if}