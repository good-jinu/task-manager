<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import type { ChatMessage } from "../types/chat";
import { Robot, User } from "./icons";
import TaskItem from "./TaskItem.svelte";

interface Props {
	message: ChatMessage;
}

let { message }: Props = $props();

function formatTime(date: Date): string {
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
</script>

<div class="flex gap-3 p-4 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
	{#if message.role === 'assistant'}
		<div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
			<Robot class="w-4 h-4 text-primary" />
		</div>
	{/if}
	
	<div class="max-w-[80%] {message.role === 'user' ? 'order-first' : ''}">
		<div class="rounded-lg p-3 {message.role === 'user' 
			? 'bg-primary text-primary-foreground ml-auto' 
			: 'bg-card border'}">
			<div class="whitespace-pre-wrap text-sm">{message.content}</div>
		</div>
		
		{#if message.tasks && message.tasks.length > 0}
			<div class="mt-2 space-y-2">
				{#each message.tasks as task}
					<TaskItem {task} />
				{/each}
			</div>
		{/if}
		
		<div class="text-xs text-muted-foreground mt-1 {message.role === 'user' ? 'text-right' : 'text-left'}">
			{formatTime(message.timestamp)}
		</div>
	</div>
	
	{#if message.role === 'user'}
		<div class="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
			<User class="w-4 h-4 text-accent" />
		</div>
	{/if}
</div>