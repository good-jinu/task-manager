<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import ChatContainer from "./ChatContainer.svelte";
import ChatInput from "./ChatInput.svelte";
import { useChatMessages } from "./hooks/useChatMessages.svelte";

interface Props {
	workspaceId: string;
	tasks?: Task[];
	onTasksUpdate?: (tasks: Task[]) => void;
}

let { workspaceId, tasks = [], onTasksUpdate }: Props = $props();

let input = $state("");
let showTaskOverview = $state(false);

const chatMessages = useChatMessages();

async function handleSendMessage(content: string) {
	await chatMessages.sendMessage(content, workspaceId, onTasksUpdate);
}

function toggleTaskOverview() {
	showTaskOverview = !showTaskOverview;
}
</script>

<div class="flex flex-col h-full bg-background-base">
	<!-- Progressive Chat Interface -->
	<div class="flex-1 overflow-hidden">
		<!-- Chat Messages with Integrated Task UI -->
		<ChatContainer 
			messages={chatMessages.messages}
			{tasks}
			{showTaskOverview}
			onToggleTaskOverview={toggleTaskOverview}
		/>
	</div>

	<!-- Enhanced Chat Input -->
	<div class="bg-surface-base">
		<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
			<ChatInput
				bind:value={input}
				onSubmit={handleSendMessage}
				isLoading={chatMessages.isLoading}
				placeholder="Ask me to create tasks, organize your work, or help with planning..."
			/>
		</div>
	</div>
</div>