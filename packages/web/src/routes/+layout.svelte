<script lang="ts">
import type { Snippet } from "svelte";
import "./layout.css";
import { QueryClientProvider } from "@tanstack/svelte-query";
import { onMount } from "svelte";
import { page } from "$app/stores";
import favicon from "$lib/assets/favicon.svg";
import ResponsiveContainer from "$lib/components/layout/ResponsiveContainer.svelte";
import { initializePWA } from "$lib/pwa-install";
import { queryClient } from "$lib/queries";
import type { LayoutData } from "./$types";

let { children, data }: { children: Snippet; data: LayoutData } = $props();

let session = $derived(data.session);
let currentPath = $derived($page.url.pathname);

onMount(() => {
	// Initialize PWA functionality
	initializePWA();
});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<QueryClientProvider client={queryClient}>
	<ResponsiveContainer {session} {currentPath}>
		{@render children()}
	</ResponsiveContainer>
</QueryClientProvider>
