<script lang="ts">
	import type { Session } from '@auth/sveltekit';
	import BottomNavigation from './BottomNavigation.svelte';
	import Header from './Header.svelte';
	import GuestBanner from '../GuestBanner.svelte';
	import { page } from '$app/stores';

	let { 
		children, 
		session,
		showGuestBanner = true,
		class: className = ""
	}: { 
		children: any; 
		session: Session | null;
		showGuestBanner?: boolean;
		class?: string;
	} = $props();

	// Check if user is a guest (not authenticated)
	let isGuest = $derived(!session);
	
	// Don't show guest banner on landing page (main page for unauthenticated users)
	let currentPath = $derived($page.url.pathname);
	let shouldShowGuestBanner = $derived(isGuest && showGuestBanner && currentPath !== '/');
</script>

<div class="min-h-screen bg-page-bg">
	<!-- Desktop Header - Hidden on mobile -->
	<div class="hidden md:block">
		<Header {session} />
	</div>

	<!-- Guest Banner - Only show for unauthenticated users on non-landing pages -->
	{#if shouldShowGuestBanner}
		<GuestBanner />
	{/if}

	<!-- Main Content Container -->
	<main class="flex-1 {className}">
		<!-- Mobile: Add top padding for status bar, bottom padding for nav -->
		<!-- Desktop: Add top padding for header -->
		<div class="pt-4 pb-20 md:pt-8 md:pb-8 px-4 md:px-6 lg:px-8">
			<div class="max-w-7xl mx-auto">
				{@render children()}
			</div>
		</div>
	</main>

	<!-- Mobile Bottom Navigation -->
	<BottomNavigation {session} />
</div>