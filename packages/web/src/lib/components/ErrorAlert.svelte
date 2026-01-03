<script lang="ts">
	import { Alert } from './ui';

	interface Props {
		error: string;
	}

	let { error }: Props = $props();
</script>

{#if error}
	<Alert variant="error" class="mb-6">
		{error}
	</Alert>
{/if}