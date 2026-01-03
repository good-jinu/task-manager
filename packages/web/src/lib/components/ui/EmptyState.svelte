<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		icon?: string;
		title: string;
		description?: string;
		action?: {
			label: string;
			href?: string;
			onclick?: () => void;
		};
	}

	let {
		icon,
		title,
		description,
		action,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const defaultIcons = {
		database: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2m0 0V6a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414A1 1 0 0016 7.414V9a2 2 0 01-2 2h-2m0 0v2a2 2 0 002 2h2a2 2 0 002-2v-2',
		page: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
		task: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
	};

	const iconPath = $derived(icon && icon in defaultIcons ? defaultIcons[icon as keyof typeof defaultIcons] : icon);

	const classes = $derived(`text-center py-12 ${className}`);
</script>

<div class={classes} {...restProps}>
	{#if iconPath}
		<svg class="mx-auto h-12 w-12 text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPath}></path>
		</svg>
	{/if}
	<h3 class="text-lg font-medium text-foreground mb-2">{title}</h3>
	{#if description}
		<p class="text-foreground-secondary text-sm mb-4">{description}</p>
	{/if}
	{#if action}
		{#if action.href}
			<a
				href={action.href}
				class="bg-primary hover:bg-primary1 text-primary-foreground font-medium py-2 px-4 rounded-lg transition-colors duration-200 inline-block"
			>
				{action.label}
			</a>
		{:else if action.onclick}
			<button
				type="button"
				onclick={action.onclick}
				class="bg-primary hover:bg-primary1 text-primary-foreground font-medium py-2 px-4 rounded-lg transition-colors duration-200"
			>
				{action.label}
			</button>
		{/if}
	{/if}
	{@render children?.()}
</div>