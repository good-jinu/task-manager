<script lang="ts">
	import type { Task } from '@notion-task-manager/db';
	import { Button } from './ui';
	import { Sparkles, KeyboardArrowDown, KeyboardArrowRight, Spinner } from './icons';
	import { cn } from './utils';

	interface ChatMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: Date;
		tasks?: Task[]; // Tasks suggested or found by AI
	}

	interface Props {
		workspaceId: string;
		onTaskSuggestion?: (tasks: Task[]) => void;
		onTaskQuery?: (query: string) => Promise<Task[]>;
		onTaskCreate?: (taskData: any) => Promise<Task>;
		class?: string;
	}

	let {
		workspaceId,
		onTaskSuggestion,
		onTaskQuery,
		onTaskCreate,
		class: className = ''
	}: Props = $props();

	let isExpanded = $state(false);
	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let isProcessing = $state(false);
	let chatContainer: HTMLDivElement;

	// Initialize with welcome message
	$effect(() => {
		if (messages.length === 0) {
			messages = [{
				id: 'welcome',
				role: 'assistant',
				content: "Hi! I'm your AI task assistant. I can help you:\n\n• Create tasks from natural language\n• Find and organize your tasks\n• Suggest what to work on next\n• Break down complex projects\n\nWhat would you like to do?",
				timestamp: new Date()
			}];
		}
	});

	// Auto-scroll to bottom when new messages are added
	$effect(() => {
		if (chatContainer && messages.length > 0) {
			setTimeout(() => {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}, 100);
		}
	});

	async function handleSubmit() {
		if (!input.trim() || isProcessing) return;

		const userMessage: ChatMessage = {
			id: Date.now().toString(),
			role: 'user',
			content: input.trim(),
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		const userInput = input.trim();
		input = '';
		isProcessing = true;

		try {
			// Determine intent and route to appropriate handler
			const response = await processUserInput(userInput);
			
			const assistantMessage: ChatMessage = {
				id: (Date.now() + 1).toString(),
				role: 'assistant',
				content: response.content,
				timestamp: new Date(),
				tasks: response.tasks
			};

			messages = [...messages, assistantMessage];

			// If tasks were suggested, notify parent
			if (response.tasks && onTaskSuggestion) {
				onTaskSuggestion(response.tasks);
			}
		} catch (error) {
			const errorMessage: ChatMessage = {
				id: (Date.now() + 1).toString(),
				role: 'assistant',
				content: "I'm sorry, I encountered an error processing your request. Please try again.",
				timestamp: new Date()
			};
			messages = [...messages, errorMessage];
		} finally {
			isProcessing = false;
		}
	}

	async function processUserInput(input: string): Promise<{ content: string; tasks?: Task[] }> {
		const lowerInput = input.toLowerCase();

		// Task creation patterns
		if (lowerInput.includes('create') || lowerInput.includes('add') || lowerInput.includes('new task')) {
			return await handleTaskCreation(input);
		}

		// Task query patterns
		if (lowerInput.includes('find') || lowerInput.includes('show') || lowerInput.includes('list') || 
			lowerInput.includes('what') || lowerInput.includes('which')) {
			return await handleTaskQuery(input);
		}

		// Suggestion patterns
		if (lowerInput.includes('suggest') || lowerInput.includes('recommend') || 
			lowerInput.includes('what should') || lowerInput.includes('next')) {
			return await handleTaskSuggestions(input);
		}

		// Default: treat as task creation
		return await handleTaskCreation(input);
	}

	async function handleTaskCreation(input: string): Promise<{ content: string; tasks?: Task[] }> {
		try {
			// Call AI parse endpoint
			const response = await fetch('/api/ai/parse-task', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ input, workspaceId })
			});

			if (!response.ok) throw new Error('Failed to parse task');

			const parsed = await response.json();
			
			if (onTaskCreate) {
				const task = await onTaskCreate(parsed);
				return {
					content: `I've created a task: "${task.title}"${task.priority ? ` with ${task.priority} priority` : ''}${task.dueDate ? ` due ${new Date(task.dueDate).toLocaleDateString()}` : ''}.`,
					tasks: [task]
				};
			} else {
				return {
					content: `I'd suggest creating a task: "${parsed.title}"${parsed.priority ? ` with ${parsed.priority} priority` : ''}${parsed.dueDate ? ` due ${new Date(parsed.dueDate).toLocaleDateString()}` : ''}.`
				};
			}
		} catch (error) {
			return {
				content: "I couldn't parse that as a task. Could you try rephrasing it? For example: 'Create a task to review the quarterly report by Friday'"
			};
		}
	}

	async function handleTaskQuery(input: string): Promise<{ content: string; tasks?: Task[] }> {
		if (!onTaskQuery) {
			return {
				content: "I can help you find tasks, but this feature isn't fully connected yet. Try asking about specific task statuses or priorities."
			};
		}

		try {
			const tasks = await onTaskQuery(input);
			
			if (tasks.length === 0) {
				return {
					content: "I couldn't find any tasks matching that description. Try being more specific or check if you have tasks in your workspace."
				};
			}

			const taskList = tasks.slice(0, 5).map(t => `• ${t.title}${t.status !== 'todo' ? ` (${t.status})` : ''}`).join('\n');
			const moreText = tasks.length > 5 ? `\n\n...and ${tasks.length - 5} more tasks.` : '';

			return {
				content: `I found ${tasks.length} task${tasks.length === 1 ? '' : 's'}:\n\n${taskList}${moreText}`,
				tasks: tasks.slice(0, 5)
			};
		} catch (error) {
			return {
				content: "I had trouble searching your tasks. Please try again with a different query."
			};
		}
	}

	async function handleTaskSuggestions(input: string): Promise<{ content: string; tasks?: Task[] }> {
		try {
			const response = await fetch('/api/ai/suggestions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ workspaceId, context: input })
			});

			if (!response.ok) throw new Error('Failed to get suggestions');

			const suggestions = await response.json();
			
			if (suggestions.length === 0) {
				return {
					content: "I don't have enough context to make specific suggestions right now. Try creating a few tasks first, or ask me to help you break down a specific project."
				};
			}

			const suggestionList = suggestions.slice(0, 3).map((s: any, i: number) => 
				`${i + 1}. ${s.title}${s.reasoning ? ` - ${s.reasoning}` : ''}`
			).join('\n');

			return {
				content: `Here are some suggestions for what to work on:\n\n${suggestionList}\n\nWould you like me to create any of these tasks?`
			};
		} catch (error) {
			return {
				content: "I couldn't generate suggestions right now. Try asking me to help you create specific tasks or organize your existing ones."
			};
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	function formatTimestamp(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class={cn('bg-white border border-gray-200 rounded-lg overflow-hidden', className)}>
	<!-- Header -->
	<button
		onclick={() => isExpanded = !isExpanded}
		class={cn(
			'w-full px-4 py-3 flex items-center justify-between',
			'bg-gradient-to-r from-purple-50 to-blue-50',
			'hover:from-purple-100 hover:to-blue-100',
			'transition-colors duration-200',
			'min-h-[44px]'
		)}
	>
		<div class="flex items-center gap-2">
			<Sparkles class="w-5 h-5 text-purple-600" />
			<span class="font-medium text-gray-900">AI Assistant</span>
			{#if messages.length > 1}
				<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
					{messages.length - 1} messages
				</span>
			{/if}
		</div>
		
		{#if isExpanded}
			<KeyboardArrowDown class="w-5 h-5 text-gray-400" />
		{:else}
			<KeyboardArrowRight class="w-5 h-5 text-gray-400" />
		{/if}
	</button>

	<!-- Chat content -->
	{#if isExpanded}
		<div class="border-t border-gray-100">
			<!-- Messages -->
			<div 
				bind:this={chatContainer}
				class="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50"
			>
				{#each messages as message (message.id)}
					<div class={cn(
						'flex gap-3',
						message.role === 'user' ? 'justify-end' : 'justify-start'
					)}>
						<div class={cn(
							'max-w-[80%] px-3 py-2 rounded-lg text-sm',
							message.role === 'user'
								? 'bg-blue-500 text-white'
								: 'bg-white border border-gray-200 text-gray-900'
						)}>
							<div class="whitespace-pre-wrap">{message.content}</div>
							
							{#if message.tasks && message.tasks.length > 0}
								<div class="mt-2 pt-2 border-t border-gray-200 space-y-1">
									{#each message.tasks as task}
										<div class="text-xs opacity-75">
											📋 {task.title}
										</div>
									{/each}
								</div>
							{/if}
							
							<div class={cn(
								'text-xs mt-1 opacity-60',
								message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
							)}>
								{formatTimestamp(message.timestamp)}
							</div>
						</div>
					</div>
				{/each}

				{#if isProcessing}
					<div class="flex justify-start">
						<div class="bg-white border border-gray-200 px-3 py-2 rounded-lg flex items-center gap-2">
							<Spinner class="w-4 h-4" />
							<span class="text-sm text-gray-600">Thinking...</span>
						</div>
					</div>
				{/if}
			</div>

			<!-- Input -->
			<div class="p-4 border-t border-gray-100 bg-white">
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
					<div class="flex gap-2">
						<input
							bind:value={input}
							onkeydown={handleKeydown}
							placeholder="Ask me anything about your tasks..."
							class={cn(
								'flex-1 px-3 py-2 border border-gray-200 rounded-lg',
								'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
								'min-h-[44px] text-sm'
							)}
							disabled={isProcessing}
						/>
						<Button
							type="submit"
							disabled={!input.trim() || isProcessing}
							loading={isProcessing}
							size="sm"
							variant="primary"
							class="min-w-[44px]"
						>
							Send
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>