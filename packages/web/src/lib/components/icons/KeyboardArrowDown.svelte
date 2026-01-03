<script lang="ts">
	import { cn } from '$lib/components/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	let props: HTMLAttributes<SVGElement> = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class={cn('', props.class)} {...props}><path fill="currentColor" d="m12 15.4l-6-6L7.4 8l4.6 4.6L16.6 8L18 9.4z"/></svg>