<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { signOut } from '@auth/sveltekit/client';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();
	
	let session = $derived(data.session);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-background">
	<!-- Navigation Header -->
	<nav class="bg-surface shadow-sm border-b border-subtle">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex items-center">
					<a href="/" class="flex-shrink-0 flex items-center">
						<h1 class="text-xl font-bold text-foreground">Notion Task Manager</h1>
					</a>
				</div>
				
				<div class="flex items-center space-x-4">
					{#if session?.user}
						<!-- Authenticated user navigation -->
						<div class="flex items-center space-x-4">
							<a 
								href="/tasks" 
								class="text-foreground-secondary hover:text-foreground px-3 py-2 rounded-md text-sm font-medium"
							>
								Databases
							</a>
							<a 
								href="/agent" 
								class="text-foreground-secondary hover:text-foreground px-3 py-2 rounded-md text-sm font-medium"
							>
								Agent
							</a>
							<a 
								href="/search" 
								class="text-foreground-secondary hover:text-foreground px-3 py-2 rounded-md text-sm font-medium"
							>
								Search Tasks
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
						<a 
							href="/user/signin" 
							class="bg-primary hover:bg-primary1 text-primary-foreground px-4 py-2 rounded-md text-sm font-medium"
						>
							Sign In
						</a>
					{/if}
				</div>
			</div>
		</div>
	</nav>

	<!-- Main content -->
	<main>
		{@render children()}
	</main>
</div>
