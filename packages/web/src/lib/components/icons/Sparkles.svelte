<script lang="ts">
	import { cn } from '$lib/components/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	let props: HTMLAttributes<SVGElement> = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class={cn('', props.class)} {...props}><path fill="currentColor" d="m9 11l3-3l3 3l-3 3zm0-7l1.5 3L14 6l-3-1.5zm6 14l-1.5-3L10 18l3 1.5zM6 14l1.5-3L6 10l-1.5 3zm3-9L7.5 2L6 5l1.5 3zm6 14l1.5 3L18 19l-1.5-3zM2 10l3 1.5L8 10l-3-1.5zm16 4l-3-1.5L12 14l3 1.5z"/></svg>