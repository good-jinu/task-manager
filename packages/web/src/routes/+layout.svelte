<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import ResponsiveContainer from '$lib/components/layout/ResponsiveContainer.svelte';
	import PWAInstallPrompt from '$lib/components/PWAInstallPrompt.svelte';
	import { initializePWA } from '$lib/pwa-install.js';
	import { offlineSyncService } from '$lib/offline-sync.js';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();
	
	let session = $derived(data.session);

	onMount(() => {
		// Initialize PWA functionality
		initializePWA();
		
		// Start offline sync service
		if (navigator.onLine) {
			offlineSyncService.syncPendingOperations();
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ResponsiveContainer {session}>
	{@render children()}
</ResponsiveContainer>

<PWAInstallPrompt />
