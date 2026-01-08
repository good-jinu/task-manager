<script lang="ts">
interface Props {
	class?: string;
}

let { class: className = "w-4 h-4" }: Props = $props();
</script>

<svg 
	class={className} 
	fill="none" 
	stroke="currentColor" 
	viewBox="0 0 24 24" 
	xmlns="http://www.w3.org/2000/svg"
>
	<path 
		stroke-linecap="round" 
		stroke-linejoin="round" 
		stroke-width="2" 
		d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
	/>
</svg>