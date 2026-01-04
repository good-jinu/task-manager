<script lang="ts">
	import { Sparkles, Spinner } from './icons';

	interface Props {
		workspaceId?: string;
	}

	let { workspaceId }: Props = $props();

	// Component state
	let messages: any[] = $state([]);
	let input = $state('');
	let isLoading = $state(false);

	async function handleSubmit() {
		if (!input.trim() || isLoading) return;

		const userMessage = {
			id: Date.now().toString(),
			role: 'user',
			content: input.trim(),
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		const currentInput = input;
		input = '';
		isLoading = true;

		try {
			// Use workspaceId if available, otherwise try to get default workspace
			let queryWorkspaceId = workspaceId;
			if (!queryWorkspaceId) {
				// Try to get user's default workspace
				const workspacesResponse = await fetch('/api/workspaces');
				if (workspacesResponse.ok) {
					const workspacesData = await workspacesResponse.json();
					if (workspacesData.workspaces && workspacesData.workspaces.length > 0) {
						queryWorkspaceId = workspacesData.workspaces[0].id;
					}
				}
			}

			if (!queryWorkspaceId) {
				throw new Error('No workspace available');
			}

			const response = await fetch('/api/ai/query', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ 
					query: currentInput,
					workspaceId: queryWorkspaceId
				})
			});

			const data = await response.json();

			const assistantMessage = {
				id: (Date.now() + 1).toString(),
				role: 'assistant',
				content: data.success ? 
					(data.tasks && data.tasks.length > 0 ? 
						`I found ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'} matching your query.` : 
						'I couldn\'t find any tasks matching your query.') :
					(data.error || 'I apologize, but I encountered an error processing your request.'),
				timestamp: new Date(),
				tasks: data.tasks || []
			};

			messages = [...messages, assistantMessage];
		} catch (err) {
			const errorMessage = {
				id: (Date.now() + 1).toString(),
				role: 'assistant',
				content: 'I apologize, but I encountered an error processing your request. Please make sure you have a workspace set up.',
				timestamp: new Date()
			};

			messages = [...messages, errorMessage];
			console.error('AI chat error:', err);
		} finally {
			isLoading = false;
		}
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="p-4">
	<!-- Chat Messages -->
	<div class="space-y-4 mb-4 max-h-96 overflow-y-auto">
		{#if messages.length === 0}
			<div class="text-center py-8">
				<Sparkles class="w-12 h-12 text-accent mx-auto mb-4" />
				<h3 class="text-lg font-medium text-foreground-base mb-2">AI Assistant</h3>
				<p class="text-foreground-secondary text-sm">
					Ask me about your tasks, get suggestions, or request help with task management.
				</p>
			</div>
		{:else}
			{#each messages as message (message.id)}
				<div class="flex gap-3 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
					<div class="max-w-[80%] {message.role === 'user' ? 'order-2' : 'order-1'}">
						<div class="px-4 py-2 rounded-lg {message.role === 'user' 
							? 'bg-primary text-primary-foreground' 
							: 'bg-surface-raised text-foreground-base'}">
							<p class="text-sm">{message.content}</p>
						</div>
						<div class="text-xs text-foreground-secondary mt-1 {message.role === 'user' ? 'text-right' : 'text-left'}">
							{formatTime(message.timestamp)}
						</div>
						
						<!-- Task suggestions -->
						{#if message.tasks && message.tasks.length > 0}
							<div class="mt-2 space-y-2">
								{#each message.tasks as task}
									<div class="bg-accent/10 border border-accent/20 rounded-lg p-3">
										<h4 class="font-medium text-accent text-sm">{task.title}</h4>
										{#if task.content}
											<p class="text-xs text-foreground-secondary mt-1">{task.content}</p>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
					
					<!-- Avatar -->
					<div class="w-8 h-8 rounded-full flex items-center justify-center {message.role === 'user' ? 'order-1 bg-primary' : 'order-2 bg-accent'} {message.role === 'user' ? 'order-1' : 'order-2'}">
						{#if message.role === 'user'}
							<svg class="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
							</svg>
						{:else}
							<Sparkles class="w-4 h-4 text-accent-foreground" />
						{/if}
					</div>
				</div>
			{/each}
		{/if}
		
		<!-- Loading indicator -->
		{#if isLoading}
			<div class="flex gap-3 justify-start">
				<div class="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
					<Sparkles class="w-4 h-4 text-accent-foreground" />
				</div>
				<div class="bg-surface-raised text-foreground-base px-4 py-2 rounded-lg">
					<div class="flex items-center gap-2">
						<Spinner class="w-4 h-4" />
						<span class="text-sm">Thinking...</span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Input Form -->
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="flex gap-2">
		<input
			bind:value={input}
			placeholder="Ask me about your tasks..."
			class="flex-1 px-3 py-2 border border-subtle-base rounded-lg bg-surface-base text-foreground-base placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
			disabled={isLoading}
		/>
		<button
			type="submit"
			disabled={!input.trim() || isLoading}
			class="px-4 py-2 bg-accent hover:bg-accent-button-hover disabled:bg-subtle-base disabled:text-muted-foreground text-accent-foreground rounded-lg transition-colors flex items-center gap-2"
		>
			{#if isLoading}
				<Spinner class="w-4 h-4" />
			{:else}
				<Sparkles class="w-4 h-4" />
			{/if}
			Ask
		</button>
	</form>
</div>