<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Form state
	let description = $state('');
	let targetDate = $state('');
	let selectedDatabaseId = $state('');
	let maxResults = $state(10);

	// UI state
	let loading = $state(false);
	let error = $state('');
	let searchResults = $state<any>(null);

	// Get databases from page data
	let databases = $derived(data.databases || []);

	async function handleSearch() {
		if (!description.trim()) {
			error = 'Please enter a task description';
			return;
		}

		if (!selectedDatabaseId) {
			error = 'Please select a database to search';
			return;
		}

		try {
			loading = true;
			error = '';
			searchResults = null;

			const requestBody: any = {
				description: description.trim(),
				databaseId: selectedDatabaseId,
				maxResults
			};

			// Only include targetDate if it's not empty
			if (targetDate.trim()) {
				requestBody.targetDate = targetDate.trim();
			}

			const response = await fetch('/api/tasks/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			const result = await response.json();

			if (response.ok && result.success) {
				searchResults = result.data;
			} else {
				error = result.error || 'Search failed';
			}
		} catch (err) {
			console.error('Search error:', err);
			error = 'An error occurred while searching. Please try again.';
		} finally {
			loading = false;
		}
	}

	function clearSearch() {
		description = '';
		targetDate = '';
		selectedDatabaseId = '';
		maxResults = 10;
		searchResults = null;
		error = '';
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
	<title>Intelligent Task Search - Notion Task Manager</title>
	<meta name="description" content="Search for tasks using natural language and relative dates with AI-powered intelligence." />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-3xl font-bold mb-2">Intelligent Task Search</h1>
		<p class="text-gray-600 mb-8">
			Use natural language to describe what you're looking for. Optionally select a specific date to find tasks created around that time.
		</p>

		<!-- Search Form -->
		<div class="bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-8">
			<form onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
				<!-- Task Description -->
				<div class="mb-6">
					<label for="description" class="block text-sm font-medium text-gray-700 mb-2">
						Task Description *
					</label>
					<textarea
						id="description"
						bind:value={description}
						placeholder="Describe the task you're looking for... (e.g., 'meeting with client about project proposal')"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						rows="3"
						required
					></textarea>
				</div>

				<!-- Database Selection -->
				<div class="mb-6">
					<label for="database" class="block text-sm font-medium text-gray-700 mb-2">
						Database to Search *
					</label>
					<select
						id="database"
						bind:value={selectedDatabaseId}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						required
					>
						<option value="">Select a database...</option>
						{#each databases as database}
							<option value={database.id}>{database.title}</option>
						{/each}
					</select>
					{#if databases.length === 0}
						<p class="text-sm text-gray-500 mt-1">
							No databases available. Please visit the <a href="/tasks" class="text-indigo-600 hover:text-indigo-800 underline">Databases page</a> to connect your Notion databases first.
						</p>
					{/if}
				</div>

				<!-- Target Date -->
				<div class="mb-6">
					<label for="targetDate" class="block text-sm font-medium text-gray-700 mb-2">
						Target Date (Optional)
					</label>
					<input
						id="targetDate"
						type="date"
						bind:value={targetDate}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
					/>
					<p class="text-sm text-gray-500 mt-1">
						Select a specific date to find tasks created around that time. Leave empty to search all dates.
					</p>
				</div>

				<!-- Advanced Options -->
				<div class="mb-6">
					<details class="group">
						<summary class="cursor-pointer text-sm font-medium text-gray-700 mb-2 hover:text-gray-900">
							Advanced Options
						</summary>
						<div class="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
							<!-- Max Results -->
							<div>
								<label for="maxResults" class="block text-sm font-medium text-gray-700 mb-1">
									Maximum Results
								</label>
								<input
									id="maxResults"
									type="number"
									bind:value={maxResults}
									min="1"
									max="100"
									class="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								/>
							</div>
						</div>
					</details>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-4">
					<button
						type="submit"
						disabled={loading || !description.trim() || !selectedDatabaseId}
						class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-md transition-colors duration-200"
					>
						{#if loading}
							<span class="flex items-center">
								<svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Searching...
							</span>
						{:else}
							Search Tasks
						{/if}
					</button>

					<button
						type="button"
						onclick={clearSearch}
						class="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-md transition-colors duration-200"
					>
						Clear
					</button>
				</div>
			</form>
		</div>

		<!-- Error Display -->
		{#if error}
			<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-8">
				<div class="flex items-center">
					<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
					</svg>
					{error}
				</div>
			</div>
		{/if}

		<!-- Search Results -->
		{#if searchResults}
			<div class="bg-white shadow-md rounded-lg px-8 pt-6 pb-8">
				<div class="flex justify-between items-center mb-6">
					<h2 class="text-xl font-semibold">Search Results</h2>
					<div class="text-sm text-gray-500">
						{searchResults.totalCount} result{searchResults.totalCount !== 1 ? 's' : ''} 
						in {searchResults.searchTime}ms
					</div>
				</div>

				{#if searchResults.results.length === 0}
					<div class="text-center py-8">
						<svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
						</svg>
						<h3 class="text-lg font-medium text-gray-900 mb-2">No results found</h3>
						<p class="text-gray-500">
							Try adjusting your search description or removing the date filter.
						</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each searchResults.results as result}
							<div class="border rounded-lg p-6 hover:shadow-md transition-shadow">
								<!-- Result Header -->
								<div class="flex justify-between items-start mb-3">
									<h3 class="text-lg font-semibold text-gray-900">
										{result.page.title}
									</h3>
									<div class="flex items-center space-x-4">
										<!-- Score -->
										<div class="text-sm text-gray-500">
											<span class="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
												Score: {result.relevanceScore.toFixed(2)}
											</span>
										</div>
										<!-- Open Link -->
										<a 
											href={result.page.url} 
											target="_blank" 
											rel="noopener noreferrer"
											class="text-indigo-600 hover:text-indigo-800 text-sm underline"
										>
											Open in Notion →
										</a>
									</div>
								</div>

								<!-- Properties -->
								<div class="text-sm text-gray-600 mb-3">
									{formatProperties(result.page.properties)}
								</div>

								<!-- Reasoning -->
								{#if result.reasoning}
									<div class="text-sm text-gray-600 italic mb-2">
										{result.reasoning}
									</div>
								{/if}

								<!-- Metadata -->
								<div class="flex justify-between items-center text-xs text-gray-500">
									<div>
										Created: {formatDate(result.page.createdTime)} | 
										Updated: {formatDate(result.page.lastEditedTime)}
									</div>
									<div>
										<span>Relevance: {result.relevanceScore.toFixed(2)}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>

				{/if}
			</div>
		{/if}
	</div>
</div>
