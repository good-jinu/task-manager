<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/components/utils';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: 'default' | 'elevated' | 'outlined';
		padding?: 'none' | 'sm' | 'md' | 'lg';
		hover?: boolean;
	}

	let {
		variant = 'default',
		padding = 'md',
		hover = false,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const baseClasses = 'rounded-xl border';
	
	const variantClasses = {
		default: 'bg-card-bg border-subtle-base',
		elevated: 'bg-card-bg shadow-sm border-subtle-base',
		outlined: 'bg-card-bg border-subtle-hover'
	};

	const paddingClasses = {
		none: '',
		sm: 'p-3',
		md: 'p-4 sm:p-6',
		lg: 'p-6 sm:p-8'
	};

	const hoverClasses = $derived(hover ? 'hover:shadow-md transition-shadow' : '');

	const classes = $derived(cn(baseClasses, variantClasses[variant], paddingClasses[padding], hoverClasses, className));
</script>

<div class={classes} {...restProps}>
	{@render children?.()}
</div>