<script lang="ts">
	import type { NotionDatabase, NotionPage, DatabaseConfig } from '@notion-task-manager/notion';

	// Use any for the arrays since dates come as strings from API
	let databases: any[] = [];
	let selectedDatabase: any | null = null;
	let pages: any[] = [];
	let savedConfigs: any[] = [];
	let loading = false;
	let error = '';

	// Load initial data
	loadSavedConfigs();
	loadDatabases();

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

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-8">Notion Database Manager</h1>

	<!-- Quick Actions -->
	<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-blue-900 mb-1">Looking for something specific?</h2>
				<p class="text-blue-700">Use our intelligent search to find tasks with natural language descriptions.</p>
			</div>
			<a
				href="/search"
				class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
			>
				Search Tasks →
			</a>
		</div>
	</div>

	{#if error}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
			{error}
		</div>
	{/if}

	<!-- Saved Configurations -->
	{#if savedConfigs.length > 0}
		<div class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
			<h2 class="text-xl font-semibold mb-4">Recently Selected Databases</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each savedConfigs as config}
					<button
						on:click={() => loadFromSavedConfig(config)}
						class="text-left p-4 border rounded-lg hover:shadow-md transition-shadow bg-blue-50 hover:bg-blue-100"
					>
						<h3 class="font-semibold text-blue-800">{config.title}</h3>
						{#if config.description}
							<p class="text-sm text-gray-600 mt-1">{config.description}</p>
						{/if}
						<p class="text-xs text-gray-500 mt-2">Selected: {formatDate(config.selectedAt)}</p>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Database Selection -->
	{#if !selectedDatabase}
		<div class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
			<h2 class="text-xl font-semibold mb-4">Select a Notion Database</h2>
			
			{#if loading}
				<p class="text-gray-600">Loading databases...</p>
			{:else if databases.length === 0}
				<p class="text-gray-600">No databases found. Make sure you have databases in your Notion workspace and have granted access to this integration.</p>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each databases as database}
						<button
							on:click={() => selectDatabase(database)}
							class="text-left p-4 border rounded-lg hover:shadow-md transition-shadow hover:bg-gray-50"
						>
							<h3 class="font-semibold">{database.title}</h3>
							{#if database.description}
								<p class="text-sm text-gray-600 mt-1">{database.description}</p>
							{/if}
							<p class="text-xs text-gray-500 mt-2">
								Created: {formatDate(database.createdTime)}
							</p>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Selected Database and Pages -->
		<div class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl font-semibold">Database: {selectedDatabase.title}</h2>
				<button
					on:click={() => { selectedDatabase = null; pages = []; }}
					class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
				>
					Back to Databases
				</button>
			</div>

			{#if selectedDatabase.description}
				<p class="text-gray-600 mb-4">{selectedDatabase.description}</p>
			{/if}

			<div class="mb-4">
				<a 
					href={selectedDatabase.url} 
					target="_blank" 
					rel="noopener noreferrer"
					class="text-blue-600 hover:text-blue-800 underline"
				>
					Open in Notion →
				</a>
			</div>

			<h3 class="text-lg font-semibold mb-4">Pages in this Database</h3>

			{#if loading}
				<p class="text-gray-600">Loading pages...</p>
			{:else if pages.length === 0}
				<p class="text-gray-600">No pages found in this database.</p>
			{:else}
				<div class="space-y-4">
					{#each pages as page}
						<div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
							<div class="flex justify-between items-start mb-2">
								<h4 class="text-lg font-semibold">{page.title}</h4>
								<a 
									href={page.url} 
									target="_blank" 
									rel="noopener noreferrer"
									class="text-blue-600 hover:text-blue-800 text-sm underline"
								>
									Open →
								</a>
							</div>

							<div class="text-sm text-gray-600 mb-2">
								{formatProperties(page.properties)}
							</div>

							<div class="text-xs text-gray-500">
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