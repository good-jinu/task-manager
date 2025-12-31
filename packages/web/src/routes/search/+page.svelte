<script lang="ts">
	import type { PageData } from './$types';

	// Define SearchHistoryRecord type locally to avoid import issues
	interface SearchQuery {
		description: string;
		databaseId: string;
		targetDate?: string;
		maxResults: number;
	}

	interface SearchResult {
		id: string;
		title: string;
		url: string;
		relevanceScore?: number;
		properties?: Record<string, unknown>;
	}

	interface SearchHistoryRecord {
		userId: string;
		searchId: string;
		status: 'pending' | 'done' | 'fail';
		query: SearchQuery;
		results?: SearchResult[];
		error?: string;
		createdAt: string;
		updatedAt: string;
		searchTime?: number;
		totalCount?: number;
	}

	let { data }: { data: PageData } = $props();

	// Form state
	let description = $state('');
	let targetDate = $state('');
	let selectedDatabaseId = $state('');
	let maxResults = $state(10);

	// UI state
	let loading = $state(false);
	let error = $state('');

	// Search history state - initialize from server data and allow updates
	let localSearchHistory = $state<SearchHistoryRecord[]>([]);
	let initialized = $state(false);

	// Initialize from server data on first render
	$effect(() => {
		if (!initialized && (data as any).searchHistory) {
			localSearchHistory = (data as any).searchHistory as SearchHistoryRecord[];
			initialized = true;
		}
	});

	// Use derived for the actual search history to display
	let searchHistory = $derived(localSearchHistory);

	// Auto-refresh interval for pending searches
	let autoRefreshInterval: ReturnType<typeof setInterval> | null = null;

	// Get databases from page data
	let databases = $derived(data.databases || []);

	// Check if there are any pending searches
	let hasPendingSearches = $derived(searchHistory.some(s => s.status === 'pending'));

	// Start auto-refresh when there are pending searches
	$effect(() => {
		if (hasPendingSearches && !autoRefreshInterval) {
			autoRefreshInterval = setInterval(() => {
				refreshSearchHistory();
			}, 10000); // Refresh every 10 seconds
		} else if (!hasPendingSearches && autoRefreshInterval) {
			clearInterval(autoRefreshInterval);
			autoRefreshInterval = null;
		}

		return () => {
			if (autoRefreshInterval) {
				clearInterval(autoRefreshInterval);
				autoRefreshInterval = null;
			}
		};
	});

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
				// Add new search to local history with pending status
				const newSearch: SearchHistoryRecord = {
					userId: '', // Will be filled by server
					searchId: result.searchId,
					status: 'pending',
					query: {
						description: description.trim(),
						databaseId: selectedDatabaseId,
						targetDate: targetDate.trim() || undefined,
						maxResults
					},
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				localSearchHistory = [newSearch, ...localSearchHistory];

				// Clear form after successful submission
				description = '';
				targetDate = '';
			} else {
				error = result.error || 'Search submission failed';
			}
		} catch (err) {
			console.error('Search error:', err);
			error = 'An error occurred while submitting the search. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function refreshSearchHistory() {
		try {
			const response = await fetch('/api/tasks/search/history');
			const result = await response.json();

			if (response.ok && result.success) {
				localSearchHistory = result.searches;
			}
		} catch (err) {
			console.error('Failed to refresh search history:', err);
		}
	}

	function clearSearch() {
		description = '';
		targetDate = '';
		selectedDatabaseId = '';
		maxResults = 10;
		error = '';
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString();
	}

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'pending':
				return 'bg-yellow-100 text-yellow-800';
			case 'done':
				return 'bg-green-100 text-green-800';
			case 'fail':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'pending':
				return '⏳';
			case 'done':
				return '✓';
			case 'fail':
				return '✗';
			default:
				return '?';
		}
	}

	function getDatabaseName(databaseId: string): string {
		const db = databases.find(d => d.id === databaseId);
		return db?.title || 'Unknown Database';
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
								Submitting...
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

		<!-- Search History Section -->
		<div class="bg-white shadow-md rounded-lg px-8 pt-6 pb-8">
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-xl font-semibold">Search History</h2>
			</div>

			{#if hasPendingSearches}
				<div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg mb-4 text-sm">
					<span class="flex items-center">
						<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Auto-refreshing for pending searches...
					</span>
				</div>
			{/if}

			{#if searchHistory.length === 0}
				<div class="text-center py-8">
					<svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
					</svg>
					<h3 class="text-lg font-medium text-gray-900 mb-2">No search history</h3>
					<p class="text-gray-500">
						Submit a search above to get started.
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each searchHistory as search}
						<div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
							<!-- Search Header -->
							<div class="flex justify-between items-start mb-3">
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-lg font-medium text-gray-900 truncate">
											{search.query.description}
										</span>
										<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getStatusColor(search.status)}">
											{getStatusIcon(search.status)} {search.status}
										</span>
									</div>
									<div class="text-sm text-gray-500">
										Database: {getDatabaseName(search.query.databaseId)}
										{#if search.query.targetDate}
											| Target: {formatDate(search.query.targetDate)}
										{/if}
									</div>
								</div>
								<div class="text-xs text-gray-400 text-right">
									{formatDateTime(search.createdAt)}
								</div>
							</div>

							<!-- Pending Status -->
							{#if search.status === 'pending'}
								<div class="flex items-center text-yellow-600 text-sm">
									<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Search in progress...
								</div>
							{/if}

							<!-- Error Display -->
							{#if search.status === 'fail' && search.error}
								<div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
									<span class="font-medium">Error:</span> {search.error}
								</div>
							{/if}

							<!-- Results Display -->
							{#if search.status === 'done' && search.results}
								<div class="mt-3">
									<div class="text-sm text-gray-500 mb-2">
										{search.results.length} result{search.results.length !== 1 ? 's' : ''}
										{#if search.searchTime}
											in {search.searchTime}ms
										{/if}
										{#if search.totalCount}
											(searched {search.totalCount} pages)
										{/if}
									</div>

									{#if search.results.length === 0}
										<div class="text-sm text-gray-500 italic">
											No matching tasks found.
										</div>
									{:else}
										<div class="space-y-2">
											{#each search.results as result}
												<div class="bg-gray-50 rounded p-3 text-sm">
													<div class="flex justify-between items-start">
														<div class="flex-1">
															<a 
																href={result.url} 
																target="_blank" 
																rel="noopener noreferrer"
																class="font-medium text-indigo-600 hover:text-indigo-800"
															>
																{result.title}
															</a>
															{#if result.relevanceScore !== undefined}
																<span class="ml-2 text-xs text-gray-500">
																	Score: {result.relevanceScore.toFixed(2)}
																</span>
															{/if}
														</div>
														<a 
															href={result.url} 
															target="_blank" 
															rel="noopener noreferrer"
															class="text-xs text-indigo-600 hover:text-indigo-800 ml-2"
														>
															Open →
														</a>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
