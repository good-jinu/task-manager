<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import type { ChatMessage } from "../types/chat";
import ChatMessageList from "./ChatMessageList.svelte";

interface Props {
	messages: ChatMessage[];
	tasks: Task[];
	showTaskOverview: boolean;
	onToggleTaskOverview: () => void;
}

let { messages, tasks, showTaskOverview, onToggleTaskOverview }: Props =
	$props();

let chatContainer: HTMLDivElement | null = $state(null);

// Auto-scroll to bottom when new messages are added
$effect(() => {
	if (chatContainer && messages.length > 0) {
		setTimeout(() => {
			chatContainer?.scrollTo({
				top: chatContainer.scrollHeight,
				behavior: "smooth",
			});
		}, 100);
	}
});
</script>

<div 
	bind:this={chatContainer}
	class="h-full overflow-y-auto scroll-smooth px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
>
	<ChatMessageList 
		{messages} 
		{tasks} 
		{showTaskOverview} 
		{onToggleTaskOverview} 
	/>
</div>