<script lang="ts">
import type { Snippet } from "svelte";
import "./layout.css";
import { onMount } from "svelte";
import { page } from "$app/stores";
import favicon from "$lib/assets/favicon.svg";
import ResponsiveContainer from "$lib/components/layout/ResponsiveContainer.svelte";
import { initializePWA } from "$lib/pwa-install";
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

<ResponsiveContainer {session} {currentPath}>
	{@render children()}
</ResponsiveContainer>
