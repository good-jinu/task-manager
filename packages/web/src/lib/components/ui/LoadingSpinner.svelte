<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Spinner } from '$lib/components/icons';
	import { cn } from '$lib/components/utils';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		size?: 'sm' | 'md' | 'lg';
		text?: string;
		center?: boolean;
	}

	let {
		size = 'md',
		text,
		center = false,
		class: className = '',
		...restProps
	}: Props = $props();

	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-6 w-6',
		lg: 'h-8 w-8'
	};

	const containerClasses = $derived(center ? 'flex items-center justify-center' : 'flex items-center');
	const classes = $derived(cn(containerClasses, className));
</script>

<div class={classes} {...restProps}>
	<Spinner class={cn(sizeClasses[size], 'text-primary mr-3')} />
	{#if text}
		<span class="text-foreground-secondary">{text}</span>
	{/if}
</div>