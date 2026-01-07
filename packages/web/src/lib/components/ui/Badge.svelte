<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import { cn } from "$lib/components/utils";

interface Props extends HTMLAttributes<HTMLSpanElement> {
	variant?:
		| "default"
		| "primary"
		| "secondary"
		| "success"
		| "warning"
		| "error"
		| "info";
	size?: "sm" | "md";
}

let {
	variant = "default",
	size = "md",
	class: className = "",
	children,
	...restProps
}: Props = $props();

const baseClasses = "inline-flex items-center font-medium rounded-full";

const variantClasses = {
	default: "bg-surface-muted text-foreground-secondary",
	primary: "bg-primary-icon-bg text-primary",
	secondary: "bg-secondary-icon-bg text-secondary",
	success: "bg-success-alert-bg text-success",
	warning: "bg-warning-alert-bg text-warning",
	error: "bg-error-alert-bg text-error",
	info: "bg-info-alert-bg text-info",
};

const sizeClasses = {
	sm: "px-2 py-1 text-xs",
	md: "px-2.5 py-1 text-sm",
};

const classes = $derived(
	cn(baseClasses, variantClasses[variant], sizeClasses[size], className),
);
</script>

<span class={classes} {...restProps}>
	{@render children?.()}
</span>