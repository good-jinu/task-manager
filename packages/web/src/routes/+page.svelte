<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
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
				Seamlessly integrate your task management with Notion. Create, organize, and track your tasks with the power of your Notion workspace.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center">
				<a
					href="/auth/signin"
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
				Powerful Task Management Features
			</h2>
			<p class="text-xl text-gray-600 max-w-2xl mx-auto">
				Everything you need to stay organized and productive, powered by Notion's flexibility.
			</p>
		</div>

		<div class="grid md:grid-cols-3 gap-8">
			<div class="text-center p-6">
				<div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">Task Organization</h3>
				<p class="text-gray-600">
					Create, organize, and prioritize your tasks with intuitive status tracking and priority levels.
				</p>
			</div>

			<div class="text-center p-6">
				<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">Team Collaboration</h3>
				<p class="text-gray-600">
					Assign tasks, set due dates, and collaborate with your team using your existing Notion workspace.
				</p>
			</div>

			<div class="text-center p-6">
				<div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">Smart Tagging</h3>
				<p class="text-gray-600">
					Organize tasks with custom tags and filters to quickly find what you need when you need it.
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
					<h3 class="text-lg font-semibold text-gray-900 mb-2">Create Your Tasks</h3>
					<p class="text-gray-600">
						Start creating and organizing your tasks with our intuitive interface.
					</p>
				</div>

				<div class="text-center">
					<div class="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
						3
					</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">Stay Organized</h3>
					<p class="text-gray-600">
						Track progress, set priorities, and collaborate with your team seamlessly.
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- CTA Section -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
		<h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
			Ready to Get Organized?
		</h2>
		<p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
			Join thousands of users who are already managing their tasks more efficiently with Notion Task Manager.
		</p>
		<a
			href="/auth/signin"
			class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 inline-block"
		>
			Start Managing Tasks Today
		</a>
	</div>
</div>