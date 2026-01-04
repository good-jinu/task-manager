<script lang="ts">
	import { onMount } from 'svelte';
	import { Warning, Spinner, Database as DatabaseIcon, Document, ArrowRightAlt } from '$lib/components/icons';

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

<div class="min-h-screen bg-page-bg">
	<div class="container mx-auto px-4 py-6 sm:py-8">
		<div class="max-w-7xl mx-auto">
			<!-- Header -->
			<div class="text-center mb-8">
				<h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground-base mb-3">Notion Database Manager</h1>
				<p class="text-foreground-secondary text-sm sm:text-base max-w-2xl mx-auto">
					Connect and manage your Notion databases for intelligent task management.
				</p>
			</div>

			{#if error}
				<div class="bg-error-alert-bg border border-error-border text-error px-4 py-3 rounded-lg mb-6">
					<div class="flex items-center">
						<Warning class="w-5 h-5 mr-2 flex-shrink-0" />
						<span class="text-sm">{error}</span>
					</div>
				</div>
			{/if}

			<!-- Quick Actions -->
			<div class="bg-gradient-to-r from-accent-icon-bg to-primary-icon-bg border border-accent-border rounded-xl p-4 sm:p-6 mb-8">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h2 class="text-lg font-semibold text-accent-button-hover mb-2">Looking for something specific?</h2>
						<p class="text-accent text-sm">Use our intelligent search to find tasks with natural language descriptions.</p>
					</div>
					<a
						href="/search"
						class="bg-accent hover:bg-accent-button-hover text-accent-foreground font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 text-sm text-center flex items-center justify-center gap-2"
					>
						Search Tasks <ArrowRightAlt class="w-4 h-4" />
					</a>
				</div>
			</div>

			<!-- Saved Configurations -->
			{#if savedConfigs.length > 0}
				<div class="bg-card-bg shadow-sm rounded-xl border border-subtle-base p-4 sm:p-6 mb-8">
					<h2 class="text-lg font-semibold text-foreground-base mb-4">Recently Selected Databases</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each savedConfigs as config}
							<button
								on:click={() => loadFromSavedConfig(config)}
								class="text-left p-4 border border-subtle-base rounded-lg hover:shadow-md transition-all bg-accent-icon-bg hover:bg-accent-button-active hover:border-accent-button-hover"
							>
								<h3 class="font-semibold text-accent mb-1 truncate">{config.title}</h3>
								{#if config.description}
									<p class="text-sm text-foreground-secondary mb-2 line-clamp-2">{config.description}</p>
								{/if}
								<p class="text-xs text-muted-foreground">Selected: {formatDate(config.selectedAt)}</p>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Database Selection -->
			{#if !selectedDatabase}
				<div class="bg-card-bg shadow-sm rounded-xl border border-subtle-base p-4 sm:p-6">
					<h2 class="text-lg font-semibold text-foreground-base mb-4">Select a Notion Database</h2>
					
					{#if loading}
						<div class="flex items-center justify-center py-12">
							<Spinner class="h-8 w-8 text-primary mr-3" />
							<span class="text-foreground-secondary">Loading databases...</span>
						</div>
					{:else if databases.length === 0}
						<div class="text-center py-12">
							<DatabaseIcon class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
							<h3 class="text-lg font-medium text-foreground-base mb-2">No databases found</h3>
							<p class="text-foreground-secondary text-sm">Make sure you have databases in your Notion workspace and have granted access to this integration.</p>
						</div>
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each databases as database}
								<button
									on:click={() => selectDatabase(database)}
									class="text-left p-4 border border-subtle-base rounded-lg hover:shadow-md transition-all hover:bg-card-hover-bg hover:border-subtle-hover"
								>
									<h3 class="font-semibold text-foreground-base mb-1 truncate">{database.title}</h3>
									{#if database.description}
										<p class="text-sm text-foreground-secondary mb-2 line-clamp-2">{database.description}</p>
									{/if}
									<p class="text-xs text-muted-foreground">
										Created: {formatDate(database.createdTime)}
									</p>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<!-- Selected Database and Pages -->
				<div class="bg-card-bg shadow-sm rounded-xl border border-subtle-base p-4 sm:p-6">
					<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-4">
						<div class="min-w-0 flex-1">
							<h2 class="text-lg font-semibold text-foreground-base mb-2">Database: {selectedDatabase.title}</h2>
							{#if selectedDatabase.description}
								<p class="text-foreground-secondary text-sm mb-3">{selectedDatabase.description}</p>
							{/if}
							<a 
								href={selectedDatabase.url} 
								target="_blank" 
								rel="noopener noreferrer"
								class="text-primary hover:text-primary-button-hover underline text-sm flex items-center gap-1"
							>
								Open in Notion <ArrowRightAlt class="w-3 h-3" />
							</a>
						</div>
						<button
							on:click={() => { selectedDatabase = null; pages = []; }}
							class="bg-secondary hover:bg-secondary-button-hover text-secondary-foreground font-medium py-2 px-4 rounded-lg transition-colors text-sm"
						>
							Back to Databases
						</button>
					</div>

					<h3 class="text-base font-semibold text-foreground-base mb-4">Pages in this Database</h3>

					{#if loading}
						<div class="flex items-center justify-center py-8">
							<Spinner class="h-6 w-6 text-primary mr-3" />

								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>

							<span class="text-foreground-secondary">Loading pages...</span>
						</div>
					{:else if pages.length === 0}
						<div class="text-center py-8">
							<Document class="mx-auto h-10 w-10 text-muted-foreground mb-3" />
							<h4 class="text-base font-medium text-foreground-base mb-1">No pages found</h4>
							<p class="text-foreground-secondary text-sm">This database doesn't contain any pages yet.</p>
						</div>
					{:else}
						<div class="space-y-4">
							{#each pages as page}
								<div class="border border-subtle-base rounded-lg p-4 hover:shadow-md transition-shadow bg-card-bg">
									<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
										<h4 class="text-base font-semibold text-foreground-base min-w-0 flex-1">{page.title}</h4>
										<a 
											href={page.url} 
											target="_blank" 
											rel="noopener noreferrer"
											class="text-primary hover:text-primary-button-hover text-sm underline flex-shrink-0 flex items-center gap-1"
										>
											Open <ArrowRightAlt class="w-3 h-3" />
										</a>
									</div>

									<div class="text-sm text-foreground-secondary mb-3 break-words">
										{formatProperties(page.properties)}
									</div>

									<div class="text-xs text-muted-foreground">
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