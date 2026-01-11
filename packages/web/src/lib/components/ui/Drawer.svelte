<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import { cn } from "$lib/components/utils";
import { Close } from "../icons";

interface Props extends HTMLAttributes<HTMLDivElement> {
	isOpen: boolean;
	position?: "left" | "right";
	size?: "sm" | "md" | "lg" | "xl";
	showBackdrop?: boolean;
	showCloseButton?: boolean;
	title?: string;
	onClose?: () => void;
}

let {
	isOpen,
	position = "right",
	size = "md",
	showBackdrop = true,
	showCloseButton = true,
	title,
	onClose,
	class: className = "",
	children,
	...restProps
}: Props = $props();

// Size configurations
const sizeClasses = {
	sm: "w-full max-w-[320px]",
	md: "w-full max-w-[400px] sm:max-w-[480px]",
	lg: "w-full max-w-[480px] sm:max-w-[520px] lg:max-w-[600px]",
	xl: "w-full max-w-[520px] sm:max-w-[600px] lg:max-w-[720px]",
};

// Position configurations
const positionClasses = $derived({
	left: {
		base: "left-0",
		transform: isOpen ? "translate-x-0" : "-translate-x-full",
	},
	right: {
		base: "right-0",
		transform: isOpen ? "translate-x-0" : "translate-x-full",
	},
});

// Handle escape key and body scroll
$effect(() => {
	if (typeof document === "undefined") return;

	if (isOpen) {
		document.body.style.overflow = "hidden";

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && onClose) {
				onClose();
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", handleKeyDown);
		};
	} else {
		document.body.style.overflow = "";
	}
});

const drawerClasses = $derived(
	cn(
		// Base positioning and styling
		"fixed top-0 h-full bg-surface-base shadow-xl z-50",
		"transform transition-transform duration-200 ease-out",
		"overflow-y-auto overscroll-contain",
		// Position
		positionClasses[position].base,
		// Size
		sizeClasses[size],
		// Transform state
		positionClasses[position].transform,
		className,
	),
);
</script>

<!-- Backdrop -->
{#if isOpen && showBackdrop}
	<div 
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
		role="button"
		tabindex="0"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose?.()}
		aria-label="Close drawer"
	></div>
{/if}

<!-- Drawer -->
<div class={drawerClasses} {...restProps}>
	<!-- Header (if title or close button is needed) -->
	{#if title || showCloseButton}
		<div class="sticky top-0 bg-surface-base/95 backdrop-blur-sm border-b border-subtle-base px-4 py-4 sm:px-6">
			<div class="flex items-center justify-between">
				{#if title}
					<h2 class="text-lg font-semibold text-foreground-base">{title}</h2>
				{:else}
					<div></div>
				{/if}
				
				{#if showCloseButton && onClose}
					<button
						onclick={onClose}
						class={cn(
							'p-2 rounded-lg text-muted-foreground hover:text-foreground-base',
							'hover:bg-surface-muted active:bg-surface-muted/80 transition-colors',
							'min-w-[44px] min-h-[44px] flex items-center justify-center',
							'touch-manipulation select-none'
						)}
						aria-label="Close drawer"
					>
						<Close class="w-5 h-5" />
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Content -->
	<div class="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-safe-area-inset-bottom">
		{@render children?.()}
	</div>
</div>