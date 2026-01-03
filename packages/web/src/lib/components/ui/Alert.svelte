<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Info, Success, Warning, Error, Close } from '$lib/components/icons';
	import { cn } from '$lib/components/utils';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: 'info' | 'success' | 'warning' | 'error';
		title?: string;
		dismissible?: boolean;
		onDismiss?: () => void;
	}

	let {
		variant = 'info',
		title,
		dismissible = false,
		onDismiss,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const variantClasses = {
		info: 'bg-info3 border-info2 text-info',
		success: 'bg-success3 border-success2 text-success',
		warning: 'bg-warning3 border-warning2 text-warning',
		error: 'bg-error3 border-error2 text-error'
	};

	const iconComponents = {
		info: Info,
		success: Success,
		warning: Warning,
		error: Error
	};

	const IconComponent = $derived(iconComponents[variant]);
	const classes = $derived(cn('border rounded-lg px-4 py-3', variantClasses[variant], className));
</script>

<div class={classes} {...restProps}>
	<div class="flex">
		<div class="flex-shrink-0">
			<IconComponent class="w-5 h-5" />
		</div>
		<div class="ml-3 flex-1">
			{#if title}
				<h3 class="text-sm font-medium mb-1">{title}</h3>
			{/if}
			<div class="text-sm">
				{@render children?.()}
			</div>
		</div>
		{#if dismissible && onDismiss}
			<div class="ml-auto pl-3">
				<button
					type="button"
					class="inline-flex rounded-md p-1.5 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-focus"
					onclick={onDismiss}
					aria-label="Dismiss alert"
				>
					<Close class="w-4 h-4" />
				</button>
			</div>
		{/if}
	</div>
</div>