<script lang="ts">
	import { canInstallPWA, installPWA, swUpdateAvailable, updateServiceWorker } from '$lib/pwa-install.js';
	import { Button, Card } from '$lib/components/ui/index.js';
	import { Close, Download, RefreshRounded } from '$lib/components/icons';

	let showInstallPrompt = $state(false);
	let showUpdatePrompt = $state(false);

	$effect(() => {
		showInstallPrompt = $canInstallPWA;
	});

	$effect(() => {
		showUpdatePrompt = $swUpdateAvailable;
	});

	async function handleInstall() {
		const success = await installPWA();
		if (success) {
			showInstallPrompt = false;
		}
	}

	function handleUpdate() {
		updateServiceWorker();
		showUpdatePrompt = false;
	}

	function dismissInstall() {
		showInstallPrompt = false;
	}

	function dismissUpdate() {
		showUpdatePrompt = false;
	}
</script>

{#if showInstallPrompt}
	<Card class="fixed bottom-4 left-4 right-4 z-50 p-4 bg-white shadow-lg border md:left-auto md:right-4 md:w-80">
		<div class="flex items-start justify-between gap-3">
			<div class="flex-1">
				<h3 class="font-semibold text-sm">Install Task Manager</h3>
				<p class="text-xs text-gray-600 mt-1">
					Install the app for a better experience with offline support
				</p>
			</div>
			<button
				onclick={dismissInstall}
				class="text-gray-400 hover:text-gray-600 p-1"
				aria-label="Dismiss"
			>
				<Close class="size-4" />
			</button>
		</div>
		<div class="flex gap-2 mt-3">
			<Button onclick={handleInstall} size="sm" class="flex-1">
				<Download class="mr-1 size-4" />
				Install
			</Button>
			<Button onclick={dismissInstall} variant="outline" size="sm">
				Later
			</Button>
		</div>
	</Card>
{/if}

{#if showUpdatePrompt}
	<Card class="fixed bottom-4 left-4 right-4 z-50 p-4 bg-blue-50 border-blue-200 shadow-lg md:left-auto md:right-4 md:w-80">
		<div class="flex items-start justify-between gap-3">
			<div class="flex-1">
				<h3 class="font-semibold text-sm text-blue-900">Update Available</h3>
				<p class="text-xs text-blue-700 mt-1">
					A new version is ready. Restart to update.
				</p>
			</div>
			<button
				onclick={dismissUpdate}
				class="text-blue-400 hover:text-blue-600 p-1"
				aria-label="Dismiss"
			>
				<Close class="size-4" />
			</button>
		</div>
		<div class="flex gap-2 mt-3">
			<Button onclick={handleUpdate} size="sm" class="flex-1 bg-blue-600 hover:bg-blue-700">
				<RefreshRounded class="mr-1 size-4" />
				Update
			</Button>
			<Button onclick={dismissUpdate} variant="outline" size="sm" class="border-blue-300 text-blue-700">
				Later
			</Button>
		</div>
	</Card>
{/if}