<script lang="ts">
	// No props needed for this page
</script>

<svelte:head>
	<title>Notion Task Manager - Organize Your Work</title>
	<meta name="description" content="A powerful task management application integrated with Notion. Organize, track, and manage your tasks efficiently." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
	<!-- Hero Section -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
		<div class="text-center">
			<h1 class="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
				Notion Task Manager
			</h1>
			<p class="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
				Connect your Notion workspace and manage your databases with ease. Browse, select, and work with your Notion data seamlessly.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center">
				<a
					href="/user/signin"
					class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200"
				>
					Get Started with Notion
				</a>
				<a
					href="#features"
					class="border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200"
				>
					Learn More
				</a>
			</div>
		</div>
	</div>

	<!-- Features Section -->
	<div id="features" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
		<div class="text-center mb-16">
			<h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
				Powerful Database Management Features
			</h2>
			<p class="text-xl text-gray-600 max-w-2xl mx-auto">
				Everything you need to browse and manage your Notion databases efficiently.
			</p>
		</div>

		<div class="grid md:grid-cols-3 gap-8">
			<div class="text-center p-6">
				<div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">Database Discovery</h3>
				<p class="text-gray-600">
					Browse and discover all your Notion databases in one place with an intuitive interface.
				</p>
			</div>

			<div class="text-center p-6">
				<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">Page Management</h3>
				<p class="text-gray-600">
					View and manage all pages within your selected databases with detailed property information.
				</p>
			</div>

			<div class="text-center p-6">
				<div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">Quick Access</h3>
				<p class="text-gray-600">
					Save your frequently used databases for quick access and seamless workflow management.
				</p>
			</div>
		</div>
	</div>

	<!-- How It Works Section -->
	<div class="bg-gray-50 py-16">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="text-center mb-16">
				<h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
					How It Works
				</h2>
				<p class="text-xl text-gray-600 max-w-2xl mx-auto">
					Get started in minutes with your existing Notion account.
				</p>
			</div>

			<div class="grid md:grid-cols-3 gap-8">
				<div class="text-center">
					<div class="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
						1
					</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">Connect Your Notion</h3>
					<p class="text-gray-600">
						Sign in securely with your Notion account using OAuth authentication.
					</p>
				</div>

				<div class="text-center">
					<div class="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
						2
					</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">Select Your Database</h3>
					<p class="text-gray-600">
						Browse your Notion databases and select the ones you want to work with.
					</p>
				</div>

				<div class="text-center">
					<div class="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
						3
					</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">Manage Your Data</h3>
					<p class="text-gray-600">
						View and manage all pages within your databases with detailed information and quick access.
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- CTA Section -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
		<h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
			Ready to Manage Your Databases?
		</h2>
		<p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
			Join users who are already managing their Notion databases more efficiently with our streamlined interface.
		</p>
		<a
			href="/user/signin"
			class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 inline-block"
		>
			Start Managing Databases Today
		</a>
	</div>
</div>