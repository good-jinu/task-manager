<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import { Database, Document, Task } from "$lib/components/icons";
import { cn } from "$lib/components/utils";

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
	class: className = "",
	children,
	...restProps
}: Props = $props();

const iconComponents = {
	database: Database,
	page: Document,
	task: Task,
};

const IconComponent = $derived(
	icon && icon in iconComponents
		? iconComponents[icon as keyof typeof iconComponents]
		: null,
);

const classes = $derived(cn("text-center py-12", className));
</script>

<div class={classes} {...restProps}>
	{#if IconComponent}
		<IconComponent class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
	{/if}
	<h3 class="text-lg font-medium text-foreground-base mb-2">{title}</h3>
	{#if description}
		<p class="text-foreground-secondary text-sm mb-4">{description}</p>
	{/if}
	{#if action}
		{#if action.href}
			<a
				href={action.href}
				class="bg-primary hover:bg-primary-button-hover text-primary-foreground font-medium py-2 px-4 rounded-lg transition-colors duration-200 inline-block"
			>
				{action.label}
			</a>
		{:else if action.onclick}
			<button
				type="button"
				onclick={action.onclick}
				class="bg-primary hover:bg-primary-button-hover text-primary-foreground font-medium py-2 px-4 rounded-lg transition-colors duration-200"
			>
				{action.label}
			</button>
		{/if}
	{/if}
	{@render children?.()}
</div>