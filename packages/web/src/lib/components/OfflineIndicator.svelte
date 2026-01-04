<script lang="ts">
	import { isOnline, syncStatus } from '$lib/offline-sync.js';
	import { Wifi, WifiOff, RefreshRounded, AlertCircle } from '$lib/components/icons';

	let online = $derived($isOnline);
	let status = $derived($syncStatus);
</script>

<div class="flex items-center gap-2 text-xs">
	{#if online}
		<div class="flex items-center gap-1 text-green-600">
			<Wifi class="size-4" />
			<span>Online</span>
		</div>
	{:else}
		<div class="flex items-center gap-1 text-orange-600">
			<WifiOff class="size-4" />
			<span>Offline</span>
		</div>
	{/if}

	{#if status === 'syncing'}
		<div class="flex items-center gap-1 text-blue-600">
			<RefreshRounded class="size-3 animate-spin" />
			<span>Syncing...</span>
		</div>
	{:else if status === 'error'}
		<div class="flex items-center gap-1 text-red-600">
			<AlertCircle class="size-3" />
			<span>Sync Error</span>
		</div>
	{/if}
</div>