<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import { cn } from "$lib/components/utils";

let { class: className, ...props }: HTMLAttributes<SVGElement> = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class={cn('', className)} {...props}><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7v2h-2v-2zm-2 4h2v2h-2zm4-4h2v2h-2zm0 4h2v2h-2zM8 13h2v2H8zm0 4h2v2H8zm6-10V4l5 5z"/></svg>