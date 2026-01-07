<script lang="ts">
let { class: className = "w-6 h-6", ...props } = $props();
</script>

<svg 
	class={className} 
	fill="none" 
	stroke="currentColor" 
	viewBox="0 0 24 24" 
	xmlns="http://www.w3.org/2000/svg"
	{...props}
>
	<path 
		stroke-linecap="round" 
		stroke-linejoin="round" 
		stroke-width="2" 
		d="M12 4v16m8-8H4"
	/>
</svg>