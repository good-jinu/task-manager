<script lang="ts">
	interface Props {
		error: string;
	}

	let { error }: Props = $props();
</script>

{#if error}
	<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
		<div class="flex items-center">
			<svg class="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
			</svg>
			<span class="text-sm">{error}</span>
		</div>
	</div>
{/if}