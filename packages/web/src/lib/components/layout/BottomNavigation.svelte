<script lang="ts">
	import { page } from '$app/stores';
	import type { Session } from '@auth/sveltekit';
	import { Home, Settings, User, Plus } from '$lib/components/icons';

	let { session }: { session: Session | null } = $props();
	
	// Get current path for active state
	let currentPath = $derived($page.url.pathname);
	
	// Navigation items
	const navItems = [
		{
			href: '/',
			icon: Home,
			label: 'Tasks',
			active: currentPath === '/' || currentPath.startsWith('/tasks')
		},
		{
			href: '/agent',
			icon: Plus,
			label: 'AI Agent',
			active: currentPath.startsWith('/agent'),
			requiresAuth: true
		},
		{
			href: session ? '/settings' : '/user/signin',
			icon: session ? Settings : User,
			label: session ? 'Settings' : 'Sign In',
			active: currentPath.startsWith('/settings') || (!session && currentPath.startsWith('/user'))
		}
	];
</script>

<!-- Bottom Navigation - Mobile Only -->
<nav class="fixed bottom-0 left-0 right-0 bg-surface-base border-t border-subtle-base md:hidden z-50">
	<div class="flex justify-around items-center h-16 px-4">
		{#each navItems as item}
			{#if !item.requiresAuth || session}
				<a
					href={item.href}
					class="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-2 py-1 rounded-lg transition-colors duration-200 {item.active 
						? 'text-primary bg-primary/10' 
						: 'text-foreground-secondary hover:text-foreground-base hover:bg-surface-raised'}"
					aria-label={item.label}
				>
					<svelte:component this={item.icon} class="w-5 h-5 mb-1" />
					<span class="text-xs font-medium">{item.label}</span>
				</a>
			{/if}
		{/each}
	</div>
</nav>

<!-- Bottom padding for content when bottom nav is visible -->
<div class="h-16 md:hidden"></div>