<script lang="ts">
	import { Spinner } from '$lib/components/icons';
	import { cn } from '$lib/components/utils';
	
	interface Props {
		variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'outline';
		size?: 'sm' | 'md' | 'lg';
		href?: string;
		loading?: boolean;
		class?: string;
		onclick?: () => void;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		children?: any;
	}

	let {
		variant = 'primary',
		size = 'md',
		href,
		loading = false,
		class: className = '',
		onclick,
		type = 'button',
		disabled = false,
		children,
		...restProps
	}: Props = $props();

	const baseClasses = 'font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-focus inline-flex items-center justify-center';
	
	const variantClasses = {
		primary: 'bg-primary hover:bg-primary1 text-primary-foreground',
		secondary: 'bg-secondary hover:bg-secondary1 text-secondary-foreground',
		accent: 'bg-accent hover:bg-accent1 text-accent-foreground',
		success: 'bg-success hover:bg-success1 text-success-foreground',
		warning: 'bg-warning hover:bg-warning1 text-warning-foreground',
		error: 'bg-error hover:bg-error1 text-error-foreground',
		outline: 'border border-subtle hover:border-subtle1 text-foreground1 hover:bg-surface1'
	};

	const sizeClasses = {
		sm: 'py-2 px-3 text-sm',
		md: 'py-2.5 px-4 text-sm',
		lg: 'py-3 px-8 text-lg'
	};

	const classes = $derived(cn(baseClasses, variantClasses[variant], sizeClasses[size], className));
</script>

{#if href}
	<a {href} class={classes} {...restProps}>
		{#if loading}
			<Spinner class="h-4 w-4 mr-2" />
		{/if}
		{@render children?.()}
	</a>
{:else}
	<button class={classes} {disabled} {type} {onclick} {...restProps}>
		{#if loading}
			<Spinner class="h-4 w-4 mr-2" />
		{/if}
		{@render children?.()}
	</button>
{/if}