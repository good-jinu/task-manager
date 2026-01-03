<script lang="ts">
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

	const classes = $derived(`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`);
</script>

{#if href}
	<a {href} class={classes} {...restProps}>
		{#if loading}
			<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		{/if}
		{@render children?.()}
	</a>
{:else}
	<button class={classes} {disabled} {type} {onclick} {...restProps}>
		{#if loading}
			<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		{/if}
		{@render children?.()}
	</button>
{/if}