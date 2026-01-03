<script lang="ts">
	import { onMount } from 'svelte';

	// Use any for the arrays since dates come as strings from API
	let databases: any[] = [];
	let selectedDatabase: any | null = null;
	let pages: any[] = [];
	let savedConfigs: any[] = [];
	let loading = false;
	let error = '';

	// Load initial data on mount
	onMount(() => {
		loadSavedConfigs();
		loadDatabases();
	});

	async function loadDatabases() {
		try {
			loading = true;
			const response = await fetch('/api/databases');
			const data = await response.json();
			
			if (response.ok) {
				databases = data.databases;
			} else {
				error = data.error || 'Failed to load databases';
			}
		} catch (err) {
			error = 'Failed to load databases';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function loadSavedConfigs() {
		try {
			const response = await fetch('/api/databases/configs');
			const data = await response.json();
			
			if (response.ok) {
				savedConfigs = data.configs;
			}
		} catch (err) {
			console.error('Failed to load saved configs:', err);
		}
	}

	async function selectDatabase(database: any) {
		try {
			loading = true;
			selectedDatabase = database;
			
			// Save this database selection
			await fetch('/api/databases', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					databaseId: database.id,
					title: database.title,
					description: database.description
				})
			});

			// Load pages from this database
			await loadDatabasePages(database.id);
			
			// Refresh saved configs
			await loadSavedConfigs();
		} catch (err) {
			error = 'Failed to select database';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function loadDatabasePages(databaseId: string) {
		try {
			const response = await fetch(`/api/databases/${databaseId}/pages`);
			const data = await response.json();
			
			if (response.ok) {
				pages = data.pages;
			} else {
				error = data.error || 'Failed to load database pages';
			}
		} catch (err) {
			error = 'Failed to load database pages';
			console.error(err);
		}
	}

	async function loadFromSavedConfig(config: any) {
		try {
			loading = true;
			
			// Find the database in our list or create a minimal one
			selectedDatabase = databases.find(db => db.id === config.databaseId) || {
				id: config.databaseId,
				title: config.title,
				description: config.description,
				url: '',
				createdTime: '',
				lastEditedTime: ''
			};

			await loadDatabasePages(config.databaseId);
		} catch (err) {
			error = 'Failed to load from saved configuration';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString();
	}

	function formatProperties(properties: Record<string, any>): string {
		const entries = Object.entries(properties);
		if (entries.length === 0) return 'No properties';
		
		return entries.slice(0, 3).map(([key, value]) => {
			if (value?.type === 'title' && value.title?.[0]?.plain_text) {
				return `${key}: ${value.title[0].plain_text}`;
			} else if (value?.type === 'rich_text' && value.rich_text?.[0]?.plain_text) {
				return `${key}: ${value.rich_text[0].plain_text}`;
			} else if (value?.type === 'select' && value.select?.name) {
				return `${key}: ${value.select.name}`;
			} else if (value?.type === 'date' && value.date?.start) {
				return `${key}: ${new Date(value.date.start).toLocaleDateString()}`;
			}
			return `${key}: ${value?.type || 'unknown'}`;
		}).join(', ');
	}
</script>

<svelte:head>
	<title>Notion Database Manager</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<div class="container mx-auto px-4 py-6 sm:py-8">
		<div class="max-w-7xl mx-auto">
			<!-- Header -->
			<div class="text-center mb-8">
				<h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">Notion Database Manager</h1>
				<p class="text-foreground-secondary text-sm sm:text-base max-w-2xl mx-auto">
					Connect and manage your Notion databases for intelligent task management.
				</p>
			</div>

			{#if error}
				<div class="bg-error3 border border-error2 text-error px-4 py-3 rounded-lg mb-6">
					<div class="flex items-center">
						<svg class="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
						</svg>
						<span class="text-sm">{error}</span>
					</div>
				</div>
			{/if}

			<!-- Quick Actions -->
			<div class="bg-gradient-to-r from-accent3 to-primary3 border border-accent2 rounded-xl p-4 sm:p-6 mb-8">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h2 class="text-lg font-semibold text-accent1 mb-2">Looking for something specific?</h2>
						<p class="text-accent text-sm">Use our intelligent search to find tasks with natural language descriptions.</p>
					</div>
					<a
						href="/search"
						class="bg-accent hover:bg-accent1 text-accent-foreground font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 text-sm text-center"
					>
						Search Tasks →
					</a>
				</div>
			</div>

			<!-- Saved Configurations -->
			{#if savedConfigs.length > 0}
				<div class="bg-surface shadow-sm rounded-xl border border-subtle p-4 sm:p-6 mb-8">
					<h2 class="text-lg font-semibold text-foreground mb-4">Recently Selected Databases</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each savedConfigs as config}
							<button
								on:click={() => loadFromSavedConfig(config)}
								class="text-left p-4 border border-subtle rounded-lg hover:shadow-md transition-all bg-accent3 hover:bg-accent2 hover:border-accent1"
							>
								<h3 class="font-semibold text-accent mb-1 truncate">{config.title}</h3>
								{#if config.description}
									<p class="text-sm text-foreground-secondary mb-2 line-clamp-2">{config.description}</p>
								{/if}
								<p class="text-xs text-muted">Selected: {formatDate(config.selectedAt)}</p>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Database Selection -->
			{#if !selectedDatabase}
				<div class="bg-surface shadow-sm rounded-xl border border-subtle p-4 sm:p-6">
					<h2 class="text-lg font-semibold text-foreground mb-4">Select a Notion Database</h2>
					
					{#if loading}
						<div class="flex items-center justify-center py-12">
							<svg class="animate-spin h-8 w-8 text-primary mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span class="text-foreground-secondary">Loading databases...</span>
						</div>
					{:else if databases.length === 0}
						<div class="text-center py-12">
							<svg class="mx-auto h-12 w-12 text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2m0 0V6a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414A1 1 0 0016 7.414V9a2 2 0 01-2 2h-2m0 0v2a2 2 0 002 2h2a2 2 0 002-2v-2"></path>
							</svg>
							<h3 class="text-lg font-medium text-foreground mb-2">No databases found</h3>
							<p class="text-foreground-secondary text-sm">Make sure you have databases in your Notion workspace and have granted access to this integration.</p>
						</div>
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each databases as database}
								<button
									on:click={() => selectDatabase(database)}
									class="text-left p-4 border border-subtle rounded-lg hover:shadow-md transition-all hover:bg-surface1 hover:border-subtle1"
								>
									<h3 class="font-semibold text-foreground mb-1 truncate">{database.title}</h3>
									{#if database.description}
										<p class="text-sm text-foreground-secondary mb-2 line-clamp-2">{database.description}</p>
									{/if}
									<p class="text-xs text-muted">
										Created: {formatDate(database.createdTime)}
									</p>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<!-- Selected Database and Pages -->
				<div class="bg-surface shadow-sm rounded-xl border border-subtle p-4 sm:p-6">
					<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-4">
						<div class="min-w-0 flex-1">
							<h2 class="text-lg font-semibold text-foreground mb-2">Database: {selectedDatabase.title}</h2>
							{#if selectedDatabase.description}
								<p class="text-foreground-secondary text-sm mb-3">{selectedDatabase.description}</p>
							{/if}
							<a 
								href={selectedDatabase.url} 
								target="_blank" 
								rel="noopener noreferrer"
								class="text-primary hover:text-primary1 underline text-sm"
							>
								Open in Notion →
							</a>
						</div>
						<button
							on:click={() => { selectedDatabase = null; pages = []; }}
							class="bg-secondary hover:bg-secondary1 text-secondary-foreground font-medium py-2 px-4 rounded-lg transition-colors text-sm"
						>
							Back to Databases
						</button>
					</div>

					<h3 class="text-base font-semibold text-foreground mb-4">Pages in this Database</h3>

					{#if loading}
						<div class="flex items-center justify-center py-8">
							<svg class="animate-spin h-6 w-6 text-primary mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span class="text-foreground-secondary">Loading pages...</span>
						</div>
					{:else if pages.length === 0}
						<div class="text-center py-8">
							<svg class="mx-auto h-10 w-10 text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
							</svg>
							<h4 class="text-base font-medium text-foreground mb-1">No pages found</h4>
							<p class="text-foreground-secondary text-sm">This database doesn't contain any pages yet.</p>
						</div>
					{:else}
						<div class="space-y-4">
							{#each pages as page}
								<div class="border border-subtle rounded-lg p-4 hover:shadow-md transition-shadow bg-surface">
									<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
										<h4 class="text-base font-semibold text-foreground min-w-0 flex-1">{page.title}</h4>
										<a 
											href={page.url} 
											target="_blank" 
											rel="noopener noreferrer"
											class="text-primary hover:text-primary1 text-sm underline flex-shrink-0"
										>
											Open →
										</a>
									</div>

									<div class="text-sm text-foreground-secondary mb-3 break-words">
										{formatProperties(page.properties)}
									</div>

									<div class="text-xs text-muted">
										Created: {formatDate(page.createdTime)} | 
										Updated: {formatDate(page.lastEditedTime)}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>