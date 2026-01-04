<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import ResponsiveContainer from '$lib/components/layout/ResponsiveContainer.svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();
	
	let session = $derived(data.session);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ResponsiveContainer {session}>
	{@render children()}
</ResponsiveContainer>
