<script lang="ts">
	import { Database, Document, Sparkles } from '$lib/components/icons';
	// No props needed for this page
</script>

<svelte:head>
	<title>Notion Task Manager - Organize Your Work</title>
	<meta name="description" content="A powerful task management application integrated with Notion. Organize, track, and manage your tasks efficiently." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-primary-icon-bg via-card-bg to-info-icon-bg">
	<!-- Hero Section -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
		<div class="text-center">
			<h1 class="text-4xl md:text-6xl font-bold text-foreground-base mb-6">
				Notion Task Manager
			</h1>
			<p class="text-xl md:text-2xl text-foreground-secondary mb-8 max-w-3xl mx-auto">
				Connect your Notion workspace and manage your databases with ease. Browse, select, and work with your Notion data seamlessly.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center">
				<a
					href="/user/signin"
					class="bg-primary hover:bg-primary-button-hover text-primary-foreground font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200"
				>
					Get Started with Notion
				</a>
				<a
					href="#features"
					class="border border-subtle-base hover:border-subtle-hover text-foreground-emphasis font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200"
				>
					Learn More
				</a>
			</div>
		</div>
	</div>

	<!-- Features Section -->
	<div id="features" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
		<div class="text-center mb-16">
			<h2 class="text-3xl md:text-4xl font-bold text-foreground-base mb-4">
				Powerful Database Management Features
			</h2>
			<p class="text-xl text-foreground-secondary max-w-2xl mx-auto">
				Everything you need to browse and manage your Notion databases efficiently.
			</p>
		</div>

		<div class="grid md:grid-cols-3 gap-8">
			<div class="text-center p-6">
				<div class="w-16 h-16 bg-primary-icon-bg rounded-full flex items-center justify-center mx-auto mb-4">
					<Database class="w-8 h-8 text-primary" />
				</div>
				<h3 class="text-xl font-semibold text-foreground-base mb-2">Database Discovery</h3>
				<p class="text-foreground-secondary">
					Browse and discover all your Notion databases in one place with an intuitive interface.
				</p>
			</div>

			<div class="text-center p-6">
				<div class="w-16 h-16 bg-success-alert-bg rounded-full flex items-center justify-center mx-auto mb-4">
					<Document class="w-8 h-8 text-success" />
				</div>
				<h3 class="text-xl font-semibold text-foreground-base mb-2">Page Management</h3>
				<p class="text-foreground-secondary">
					View and manage all pages within your selected databases with detailed property information.
				</p>
			</div>

			<div class="text-center p-6">
				<div class="w-16 h-16 bg-accent-icon-bg rounded-full flex items-center justify-center mx-auto mb-4">
					<Sparkles class="w-8 h-8 text-accent" />
				</div>
				<h3 class="text-xl font-semibold text-foreground-base mb-2">Quick Access</h3>
				<p class="text-foreground-secondary">
					Save your frequently used databases for quick access and seamless workflow management.
				</p>
			</div>
		</div>
	</div>

	<!-- How It Works Section -->
	<div class="bg-section-bg py-16">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="text-center mb-16">
				<h2 class="text-3xl md:text-4xl font-bold text-foreground-base mb-4">
					How It Works
				</h2>
				<p class="text-xl text-foreground-secondary max-w-2xl mx-auto">
					Get started in minutes with your existing Notion account.
				</p>
			</div>

			<div class="grid md:grid-cols-3 gap-8">
				<div class="text-center">
					<div class="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
						1
					</div>
					<h3 class="text-lg font-semibold text-foreground-base mb-2">Connect Your Notion</h3>
					<p class="text-foreground-secondary">
						Sign in securely with your Notion account using OAuth authentication.
					</p>
				</div>

				<div class="text-center">
					<div class="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
						2
					</div>
					<h3 class="text-lg font-semibold text-foreground-base mb-2">Select Your Database</h3>
					<p class="text-foreground-secondary">
						Browse your Notion databases and select the ones you want to work with.
					</p>
				</div>

				<div class="text-center">
					<div class="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
						3
					</div>
					<h3 class="text-lg font-semibold text-foreground-base mb-2">Manage Your Data</h3>
					<p class="text-foreground-secondary">
						View and manage all pages within your databases with detailed information and quick access.
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- CTA Section -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
		<h2 class="text-3xl md:text-4xl font-bold text-foreground-base mb-4">
			Ready to Manage Your Databases?
		</h2>
		<p class="text-xl text-foreground-secondary mb-8 max-w-2xl mx-auto">
			Join users who are already managing their Notion databases more efficiently with our streamlined interface.
		</p>
		<a
			href="/user/signin"
			class="bg-primary hover:bg-primary-button-hover text-primary-foreground font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 inline-block"
		>
			Start Managing Databases Today
		</a>
	</div>
</div>