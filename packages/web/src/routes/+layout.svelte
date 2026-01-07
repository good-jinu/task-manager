<script lang="ts">
import type { Snippet } from "svelte";
import "./layout.css";
import { onMount } from "svelte";
import favicon from "$lib/assets/favicon.svg";
import ResponsiveContainer from "$lib/components/layout/ResponsiveContainer.svelte";
import { offlineSyncService } from "$lib/offline-sync";
import { initializePWA } from "$lib/pwa-install";
import type { LayoutData } from "./$types";

let { children, data }: { children: Snippet; data: LayoutData } = $props();

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
