<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

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

	const iconPaths = {
		info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
		warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z',
		error: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
	};

	const classes = $derived(`border rounded-lg px-4 py-3 ${variantClasses[variant]} ${className}`);
</script>

<div class={classes} {...restProps}>
	<div class="flex">
		<div class="flex-shrink-0">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPaths[variant]}></path>
			</svg>
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
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>
		{/if}
	</div>
</div>