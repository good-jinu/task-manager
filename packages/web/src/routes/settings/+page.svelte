<script lang="ts">
import type { ExternalIntegration } from "@notion-task-manager/db";
import { onMount } from "svelte";
import {
	Database,
	Settings as SettingsIcon,
	User,
} from "$lib/components/icons";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

let session = $derived(data.session);
let integrations: ExternalIntegration[] = $state([]);
let loading = $state(false);

onMount(() => {
	loadIntegrations();
});

async function loadIntegrations() {
	try {
		loading = true;
		const response = await fetch("/api/integrations");
		const data = await response.json();

		if (response.ok) {
			integrations = data.integrations || [];
		}
	} catch (err) {
		console.error("Error loading integrations:", err);
	} finally {
		loading = false;
	}
}
</script>

<svelte:head>
	<title>Settings - Task Manager</title>
	<meta name="description" content="Manage your task manager settings and integrations." />
</svelte:head>

<div class="min-h-screen bg-page-bg">
	<div class="max-w-4xl mx-auto">
		<div class="mb-6">
			<h1 class="text-2xl font-bold text-foreground-base mb-2 flex items-center gap-2">
				<SettingsIcon class="w-6 h-6" />
				Settings
			</h1>
			<p class="text-foreground-secondary">Manage your integrations and preferences</p>
		</div>

		<!-- User Info -->
		{#if session?.user}
			<div class="bg-card-bg border border-subtle-base rounded-xl p-6 mb-6">
				<h2 class="text-lg font-semibold text-foreground-base mb-4 flex items-center gap-2">
					<User class="w-5 h-5" />
					Account
				</h2>
				<div class="flex items-center gap-4">
					{#if session.user.image}
						<img 
							src={session.user.image} 
							alt={session.user.name || 'User'} 
							class="w-12 h-12 rounded-full"
						/>
					{/if}
					<div>
						<div class="font-medium text-foreground-base">
							{session.user.name || 'User'}
						</div>
						<div class="text-sm text-foreground-secondary">
							{session.user.email}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Integrations -->
		<div class="bg-card-bg border border-subtle-base rounded-xl p-6">
			<h2 class="text-lg font-semibold text-foreground-base mb-4 flex items-center gap-2">
				<Database class="w-5 h-5" />
				Integrations
			</h2>
			
			{#if loading}
				<div class="text-center py-8">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
					<p class="text-foreground-secondary mt-2">Loading integrations...</p>
				</div>
			{:else if integrations.length === 0}
				<div class="text-center py-8">
					<Database class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
					<h3 class="text-lg font-medium text-foreground-base mb-2">No integrations yet</h3>
					<p class="text-foreground-secondary text-sm mb-4">
						Connect external services to sync your tasks
					</p>
					<button class="bg-primary hover:bg-primary-button-hover text-primary-foreground px-4 py-2 rounded-lg transition-colors">
						Add Integration
					</button>
				</div>
			{:else}
				<div class="space-y-4">
					{#each integrations as integration}
						<div class="border border-subtle-base rounded-lg p-4">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="font-medium text-foreground-base">
										{integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)}
									</h3>
									<p class="text-sm text-foreground-secondary">
										{integration.syncEnabled ? 'Sync enabled' : 'Sync disabled'}
									</p>
								</div>
								<div class="flex items-center gap-2">
									<div class="w-3 h-3 rounded-full {integration.syncEnabled ? 'bg-success' : 'bg-muted-foreground'}"></div>
									<button class="text-sm text-primary hover:text-primary-button-hover">
										Configure
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>