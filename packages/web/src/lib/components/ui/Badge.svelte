<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
		size?: 'sm' | 'md';
	}

	let {
		variant = 'default',
		size = 'md',
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const baseClasses = 'inline-flex items-center font-medium rounded-full';
	
	const variantClasses = {
		default: 'bg-surface2 text-foreground-secondary',
		primary: 'bg-primary3 text-primary',
		secondary: 'bg-secondary3 text-secondary',
		success: 'bg-success3 text-success',
		warning: 'bg-warning3 text-warning',
		error: 'bg-error3 text-error',
		info: 'bg-info3 text-info'
	};

	const sizeClasses = {
		sm: 'px-2 py-1 text-xs',
		md: 'px-2.5 py-1 text-sm'
	};

	const classes = $derived(`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`);
</script>

<span class={classes} {...restProps}>
	{@render children?.()}
</span>