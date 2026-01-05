<script lang="ts">
	import { signOut } from '@auth/sveltekit/client';
	import type { Session } from '@auth/sveltekit';
	import { Settings } from '$lib/components/icons';

	let { session }: { session: Session | null } = $props();
</script>

<!-- Desktop Header -->
<nav class="bg-header-bg shadow-sm border-b border-subtle-base">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between h-16">
			<div class="flex items-center">
				<a href="/" class="flex-shrink-0 flex items-center">
					<h1 class="text-xl font-bold text-foreground-base">Task Manager</h1>
				</a>
			</div>
			
			<div class="flex items-center space-x-4">
				{#if session?.user}
					<!-- Authenticated user navigation -->
					<div class="flex items-center space-x-4">
						<a 
							href="/" 
							class="text-foreground-secondary hover:text-foreground-base px-3 py-2 rounded-md text-sm font-medium"
						>
							Tasks
						</a>
						<a 
							href="/agent" 
							class="text-foreground-secondary hover:text-foreground-base px-3 py-2 rounded-md text-sm font-medium"
						>
							AI Agent
						</a>
						<div class="flex items-center space-x-3">
							{#if session.user.image}
								<img 
									src={session.user.image} 
									alt={session.user.name || 'User'} 
									class="h-8 w-8 rounded-full"
								/>
							{/if}
							<span class="text-sm text-foreground-secondary">
								{session.user.name || session.user.email}
							</span>
							<a
								href="/settings"
								class="text-foreground-secondary hover:text-foreground-base p-2 rounded-md"
								aria-label="Settings"
							>
								<Settings class="w-5 h-5" />
							</a>
							<button
								onclick={() => signOut()}
								class="text-muted-foreground hover:text-foreground-secondary px-3 py-2 rounded-md text-sm font-medium"
							>
								Sign Out
							</button>
						</div>
					</div>
				{:else}
					<!-- Unauthenticated user navigation -->
					<div class="flex items-center space-x-4">
						<a 
							href="/" 
							class="text-foreground-secondary hover:text-foreground-base px-3 py-2 rounded-md text-sm font-medium"
						>
							Tasks
						</a>
						<a 
							href="/agent" 
							class="text-foreground-secondary hover:text-foreground-base px-3 py-2 rounded-md text-sm font-medium"
						>
							AI Agent
						</a>
						<a 
							href="/user/signin" 
							class="bg-primary hover:bg-primary-button-hover text-primary-foreground px-4 py-2 rounded-md text-sm font-medium"
						>
							Sign In
						</a>
					</div>
				{/if}
			</div>
		</div>
	</div>
</nav>