<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import { cn } from "$lib/components/utils";

let { class: className, ...props }: HTMLAttributes<SVGElement> = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class={cn('', className)} {...props}><path fill="currentColor" d="M12 2L1 21h22zm0 3.99L19.53 19H4.47zM11 16h2v2h-2zm0-6h2v4h-2z"/></svg>