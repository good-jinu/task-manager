<script lang="ts">
	import { Database, Document, Sparkles } from '$lib/components/icons';
</script>

<div class="min-h-screen bg-gradient-to-br from-primary-icon-bg via-card-bg to-info-icon-bg overflow-hidden">
	<!-- Animated Background Elements -->
	<div class="fixed inset-0 pointer-events-none">
		<div class="absolute top-20 left-10 w-32 h-32 bg-accent/10 rounded-full blur-xl animate-float"></div>
		<div class="absolute top-40 right-20 w-24 h-24 bg-success/10 rounded-full blur-lg animate-organic-bounce animate-delay-1"></div>
		<div class="absolute bottom-32 left-1/4 w-40 h-40 bg-primary/5 rounded-full blur-2xl animate-float animate-delay-2"></div>
		<div class="absolute bottom-20 right-1/3 w-28 h-28 bg-info/10 rounded-full blur-xl animate-organic-bounce animate-delay-3"></div>
		<div class="absolute top-1/2 left-1/2 w-36 h-36 bg-accent/5 rounded-full blur-3xl animate-float animate-delay-4"></div>
	</div>

	<!-- Hero Section -->
	<div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
		<div class="text-center">
			<!-- AI Badge -->
			<div class="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-2 mb-6 animate-pulse-glow">
				<Sparkles class="w-4 h-4 text-accent animate-pulse" />
				<span class="text-sm font-medium text-accent">Powered by AI</span>
			</div>
			
			<h1 class="text-4xl md:text-6xl font-bold mb-6 landing-text-gradient">
				AI Task Manager
			</h1>
			<p class="text-xl md:text-2xl text-foreground-secondary mb-8 max-w-3xl mx-auto leading-relaxed">
				Transform natural language into organized tasks. Our AI agent seamlessly integrates with your existing Notion databases, understanding context and managing tasks intelligently.
			</p>
			
			<!-- Example Query Demo -->
			<div class="bg-surface-base/80 backdrop-blur-sm border border-subtle-base rounded-2xl p-6 mb-8 max-w-2xl mx-auto shadow-lg">
				<div class="text-sm text-foreground-secondary mb-2">Try saying:</div>
				<div class="text-foreground-base font-medium italic">
					"Fix Android UI crash on Samsung Galaxy One UI 7"
				</div>
				<div class="text-xs text-accent mt-2">→ AI searches existing tasks, creates or updates intelligently</div>
			</div>
			
			<div class="flex flex-col sm:flex-row gap-4 justify-center">
				<a
					href="/user/signin"
					class="landing-button-primary text-primary-foreground font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
				>
					Start with Your Notion
				</a>
				<a
					href="#features"
					class="border border-subtle-base hover:border-accent/50 text-foreground-emphasis font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 hover:bg-accent/5"
				>
					See How It Works
				</a>
			</div>
		</div>
	</div>

	<!-- AI Features Section -->
	<div id="features" class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
		<div class="text-center mb-16">
			<h2 class="text-3xl md:text-4xl font-bold text-foreground-base mb-4">
				Intelligent Task Management
			</h2>
			<p class="text-xl text-foreground-secondary max-w-2xl mx-auto">
				Experience the power of AI-driven task management that understands context and learns from your workflow.
			</p>
		</div>

		<div class="grid md:grid-cols-3 gap-8">
			<!-- Natural Language Processing -->
			<div class="group text-center p-8 bg-surface-base/50 backdrop-blur-sm rounded-2xl border border-subtle-base hover:border-accent/30 landing-card-hover">
				<div class="w-16 h-16 bg-gradient-to-br from-accent to-accent-button-hover rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:rotate-6 transition-transform duration-300">
					<Sparkles class="w-8 h-8 text-accent-foreground" />
				</div>
				<h3 class="text-xl font-semibold text-foreground-base mb-3">Natural Language Processing</h3>
				<p class="text-foreground-secondary leading-relaxed">
					Simply describe your task in plain English. Our AI extracts keywords, priorities, and context automatically.
				</p>
				<div class="mt-4 text-xs text-accent font-mono bg-accent/10 rounded-lg p-2">
					"Fix login timeout on iOS" → Parsed & Categorized
				</div>
			</div>

			<!-- Smart Search & Matching -->
			<div class="group text-center p-8 bg-surface-base/50 backdrop-blur-sm rounded-2xl border border-subtle-base hover:border-success/30 landing-card-hover">
				<div class="w-16 h-16 bg-gradient-to-br from-success to-success-border rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:rotate-6 transition-transform duration-300">
					<Database class="w-8 h-8 text-surface-base" />
				</div>
				<h3 class="text-xl font-semibold text-foreground-base mb-3">Smart Search & Matching</h3>
				<p class="text-foreground-secondary leading-relaxed">
					AI searches existing tasks using multiple keywords and semantic understanding to prevent duplicates.
				</p>
				<div class="mt-4 text-xs text-success font-mono bg-success/10 rounded-lg p-2">
					Searches: ["android", "ui", "crash", "samsung"]
				</div>
			</div>

			<!-- Seamless Notion Integration -->
			<div class="group text-center p-8 bg-surface-base/50 backdrop-blur-sm rounded-2xl border border-subtle-base hover:border-primary/30 landing-card-hover">
				<div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-button-hover rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:rotate-6 transition-transform duration-300">
					<Document class="w-8 h-8 text-primary-foreground" />
				</div>
				<h3 class="text-xl font-semibold text-foreground-base mb-3">Seamless Notion Integration</h3>
				<p class="text-foreground-secondary leading-relaxed">
					Works with your existing Notion databases. No migration needed - just connect and start managing tasks intelligently.
				</p>
				<div class="mt-4 text-xs text-primary font-mono bg-primary/10 rounded-lg p-2">
					Updates existing pages or creates new ones
				</div>
			</div>
		</div>
	</div>

	<!-- AI Agent Demo Section -->
	<div class="bg-gradient-to-r from-section-bg to-surface-base py-20">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="text-center mb-16">
				<h2 class="text-3xl md:text-4xl font-bold text-foreground-base mb-4">
					See the AI Agent in Action
				</h2>
				<p class="text-xl text-foreground-secondary max-w-2xl mx-auto">
					Watch how natural language transforms into organized, searchable tasks in your Notion database.
				</p>
			</div>

			<div class="grid lg:grid-cols-2 gap-12 items-center">
				<!-- Demo Input -->
				<div class="space-y-6">
					<div class="bg-surface-base border border-subtle-base rounded-2xl p-6 shadow-lg">
						<div class="text-sm text-foreground-secondary mb-3">User Input:</div>
						<div class="bg-accent/5 border border-accent/20 rounded-xl p-4 font-mono text-foreground-base">
							"Android UI crash on Samsung Galaxy One UI 7"
						</div>
					</div>
					
					<div class="flex items-center justify-center">
						<div class="w-8 h-8 bg-accent rounded-full flex items-center justify-center animate-pulse">
							<Sparkles class="w-4 h-4 text-accent-foreground" />
						</div>
					</div>
					
					<!-- AI Processing -->
					<div class="bg-surface-base border border-subtle-base rounded-2xl p-6 shadow-lg">
						<div class="text-sm text-foreground-secondary mb-3">AI Processing:</div>
						<div class="space-y-2 text-sm">
							<div class="flex items-center gap-2">
								<div class="w-2 h-2 bg-success rounded-full"></div>
								<span class="text-foreground-base">Extracted keywords: android, ui, crash, samsung, galaxy, one ui 7</span>
							</div>
							<div class="flex items-center gap-2">
								<div class="w-2 h-2 bg-success rounded-full"></div>
								<span class="text-foreground-base">Searching existing tasks...</span>
							</div>
							<div class="flex items-center gap-2">
								<div class="w-2 h-2 bg-success rounded-full"></div>
								<span class="text-foreground-base">No similar task found - creating new task</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Demo Output -->
				<div class="bg-surface-base border border-subtle-base rounded-2xl p-6 shadow-lg">
					<div class="text-sm text-foreground-secondary mb-4">Created in Notion:</div>
					<div class="space-y-4">
						<div class="border border-subtle-base rounded-xl p-4">
							<div class="font-semibold text-foreground-base mb-2">🐛 Android UI Crash - Samsung Galaxy One UI 7</div>
							<div class="text-sm text-foreground-secondary space-y-1">
								<div><strong>Priority:</strong> High</div>
								<div><strong>Tags:</strong> Android, UI, Bug, Samsung</div>
								<div><strong>Status:</strong> To Do</div>
								<div><strong>Created:</strong> {new Date().toLocaleDateString()}</div>
							</div>
						</div>
						<div class="text-xs text-success bg-success/10 rounded-lg p-3">
							✅ Task created successfully with intelligent categorization
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Integration Benefits Section -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
		<div class="text-center mb-16">
			<h2 class="text-3xl md:text-4xl font-bold text-foreground-base mb-4">
				Why Choose AI Task Manager?
			</h2>
			<p class="text-xl text-foreground-secondary max-w-2xl mx-auto">
				Built for teams and individuals who want intelligent task management without changing their workflow.
			</p>
		</div>

		<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
			<div class="text-center group">
				<div class="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
					<span class="text-2xl">🧠</span>
				</div>
				<h3 class="font-semibold text-foreground-base mb-2">Context Aware</h3>
				<p class="text-sm text-foreground-secondary">Understands task relationships and project context</p>
			</div>

			<div class="text-center group">
				<div class="w-20 h-20 bg-gradient-to-br from-success/20 to-success/10 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
					<span class="text-2xl">⚡</span>
				</div>
				<h3 class="font-semibold text-foreground-base mb-2">Instant Setup</h3>
				<p class="text-sm text-foreground-secondary">Works with existing Notion databases immediately</p>
			</div>

			<div class="text-center group">
				<div class="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
					<span class="text-2xl">🔄</span>
				</div>
				<h3 class="font-semibold text-foreground-base mb-2">Smart Updates</h3>
				<p class="text-sm text-foreground-secondary">Automatically updates existing tasks instead of duplicating</p>
			</div>

			<div class="text-center group">
				<div class="w-20 h-20 bg-gradient-to-br from-info/20 to-info/10 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
					<span class="text-2xl">🎯</span>
				</div>
				<h3 class="font-semibold text-foreground-base mb-2">Precise Matching</h3>
				<p class="text-sm text-foreground-secondary">Advanced keyword extraction and semantic search</p>
			</div>
		</div>

		<!-- Integration Highlight -->
		<div class="mt-16 bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-3xl p-8 text-center">
			<h3 class="text-2xl font-bold text-foreground-base mb-4">
				🚀 Zero Migration Required
			</h3>
			<p class="text-lg text-foreground-secondary max-w-3xl mx-auto">
				Keep using your existing Notion workspace exactly as it is. Our AI agent integrates seamlessly with your current databases, properties, and workflow - no setup complexity, no data migration.
			</p>
		</div>
	</div>

	<!-- CTA Section -->
	<div class="bg-gradient-to-r from-primary/10 via-accent/5 to-success/10 py-20">
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
			<h2 class="text-3xl md:text-4xl font-bold text-foreground-base mb-6">
				Ready to Experience AI-Powered Task Management?
			</h2>
			<p class="text-xl text-foreground-secondary mb-8 max-w-2xl mx-auto">
				Join teams already using intelligent task management to streamline their Notion workflows and boost productivity.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center">
				<a
					href="/user/signin"
					class="landing-button-primary text-primary-foreground font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
				>
					Connect Your Notion Now
				</a>
				<a
					href="#features"
					class="border border-accent/30 hover:border-accent text-accent font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 hover:bg-accent/5"
				>
					Watch Demo
				</a>
			</div>
			<div class="mt-6 text-sm text-foreground-secondary">
				✨ Free to try • 🔒 Secure OAuth • ⚡ Instant setup
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes float {
		0%, 100% { transform: translateY(0px); }
		50% { transform: translateY(-20px); }
	}

	@keyframes organic-bounce {
		0%, 100% { transform: translateY(0px) scale(1); }
		25% { transform: translateY(-15px) scale(1.05); }
		50% { transform: translateY(-10px) scale(0.95); }
		75% { transform: translateY(-5px) scale(1.02); }
	}

	@keyframes pulse-glow {
		0%, 100% { box-shadow: 0 0 5px rgba(var(--accent), 0.3); }
		50% { box-shadow: 0 0 20px rgba(var(--accent), 0.6); }
	}

	.animate-float {
		animation: float 6s ease-in-out infinite;
	}

	.animate-organic-bounce {
		animation: organic-bounce 8s ease-in-out infinite;
	}

	.animate-pulse-glow {
		animation: pulse-glow 2s ease-in-out infinite;
	}

	.animate-delay-1 { animation-delay: 1s; }
	.animate-delay-2 { animation-delay: 2s; }
	.animate-delay-3 { animation-delay: 3s; }
	.animate-delay-4 { animation-delay: 4s; }

	.landing-text-gradient {
		background: linear-gradient(135deg, var(--foreground-base) 0%, var(--accent) 50%, var(--primary) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.landing-button-primary {
		background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
	}

	.landing-button-primary:hover {
		background: linear-gradient(135deg, var(--primary-button-hover) 0%, var(--accent-button-hover) 100%);
	}

	.landing-card-hover {
		transition: all 0.3s ease;
	}

	.landing-card-hover:hover {
		transform: translateY(-5px);
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
	}
</style>