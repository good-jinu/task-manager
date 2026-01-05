<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import TaskInputSimple from '$lib/components/TaskInputSimple.svelte';
	import AIAgentChatSimple from '$lib/components/AIAgentChatSimple.svelte';
	import TaskListSimple from '$lib/components/TaskListSimple.svelte';
	import LandingPage from '$lib/components/LandingPage.svelte';
	import GuestBanner from '$lib/components/GuestBanner.svelte';
	import AccountCreationDialog from '$lib/components/AccountCreationDialog.svelte';
	import { Plus, Sparkles } from '$lib/components/icons';
	import { guestUser, isGuestMode, registerGuestUser, checkExistingGuest, migrateGuestTasks, updateGuestTaskCount, getGuestTaskCount } from '$lib/stores/guest';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	
	// Reactive session data
	let session = $derived(data.session);
	let isAuthenticated = $derived(!!session);
	let showLandingPage = $derived(!isAuthenticated && !$isGuestMode);
	
	// Component state
	let tasks: any[] = $state([]);
	let workspaces: any[] = $state([]);
	let currentWorkspace: any = $state(null);
	let loading = $state(false);
	let error = $state('');
	let showAIChat = $state(false);
	let guestTaskCount = $state(0);
	let showAccountDialog = $state(false);
	
	// Quick actions for mobile
	let showQuickActions = $state(false);

	onMount(async () => {
		if (isAuthenticated) {
			// Authenticated user - load workspaces normally
			await loadWorkspaces();
		} else {
			// Check if user is already a guest
			const hasExistingGuest = checkExistingGuest();
			
			if (hasExistingGuest) {
				// Load guest workspace from cookie/storage
				await loadGuestWorkspace();
			}
			// If no existing guest, user will see landing page
		}
	});

	async function loadGuestWorkspace() {
		try {
			// If we have a guest cookie but no guest user state, we need to reconstruct it
			// For now, we'll create a minimal workspace object
			// In a real implementation, you might want to fetch the workspace details
			const guestWorkspace = {
				id: 'guest-workspace',
				userId: 'guest',
				name: 'My Tasks',
				description: 'Guest workspace',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
			
			currentWorkspace = guestWorkspace;
			await loadTasks();
		} catch (err) {
			console.error('Failed to load guest workspace:', err);
			error = 'Failed to load guest workspace';
		}
	}

	async function handleGuestRegistration() {
		try {
			loading = true;
			const guest = await registerGuestUser();
			currentWorkspace = guest.workspace;
			await loadTasks();
		} catch (err) {
			console.error('Failed to register guest:', err);
			error = 'Failed to start guest session';
		} finally {
			loading = false;
		}
	}

	async function handleGuestSignUp() {
		// Show account creation dialog instead of direct redirect
		showAccountDialog = true;
	}

	async function handleAccountCreation(migrateData: boolean) {
		if (!$guestUser) {
			// If no guest user, just redirect to sign in
			goto('/user/signin');
			return;
		}

		try {
			if (migrateData) {
				// Migrate guest tasks first
				await migrateGuestTasks($guestUser.id);
			}
			
			// Redirect to sign in page
			goto('/user/signin');
		} catch (err) {
			console.error('Failed to handle account creation:', err);
			throw err; // Let the dialog handle the error
		}
	}

	async function handleGuestMigration() {
		if (!$guestUser) return;
		
		try {
			loading = true;
			await migrateGuestTasks($guestUser.id);
			// After migration, reload the page to get authenticated state
			window.location.reload();
		} catch (err) {
			console.error('Failed to migrate guest tasks:', err);
			error = 'Failed to migrate tasks';
		} finally {
			loading = false;
		}
	}

	async function loadWorkspaces() {
		try {
			const response = await fetch('/api/workspaces');
			const data = await response.json();
			
			if (response.ok) {
				workspaces = data.data || [];
				// Set current workspace to first one if available
				if (workspaces.length > 0 && !currentWorkspace) {
					currentWorkspace = workspaces[0];
					await loadTasks();
				}
			} else {
				error = data.error || 'Failed to load workspaces';
			}
		} catch (err) {
			error = 'Failed to load workspaces';
			console.error('Error loading workspaces:', err);
		}
	}

	async function loadTasks() {
		if (!currentWorkspace) return;
		
		try {
			loading = true;
			error = '';
			
			const response = await fetch(`/api/tasks?workspaceId=${currentWorkspace.id}`);
			const data = await response.json();
			
			if (response.ok) {
				tasks = data.data?.items || [];
				guestTaskCount = tasks.length; // Update guest task count
				
				// Update guest store if in guest mode
				if ($isGuestMode && !isAuthenticated) {
					updateGuestTaskCount(tasks.length);
				}
			} else {
				error = data.error || 'Failed to load tasks';
			}
		} catch (err) {
			error = 'Failed to load tasks';
			console.error('Error loading tasks:', err);
		} finally {
			loading = false;
		}
	}

	function handleTaskCreated(event: CustomEvent) {
		const newTask = event.detail;
		tasks = [newTask, ...tasks];
		guestTaskCount = tasks.length; // Update guest task count
		
		// Update guest store if in guest mode
		if ($isGuestMode && !isAuthenticated) {
			updateGuestTaskCount(tasks.length);
		}
	}

	function handleTaskUpdated(event: CustomEvent) {
		const updatedTask = event.detail;
		tasks = tasks.map(task => 
			task.id === updatedTask.id ? updatedTask : task
		);
	}

	function handleTaskDeleted(event: CustomEvent) {
		const deletedTaskId = event.detail;
		tasks = tasks.filter(task => task.id !== deletedTaskId);
		guestTaskCount = tasks.length; // Update guest task count
		
		// Update guest store if in guest mode
		if ($isGuestMode && !isAuthenticated) {
			updateGuestTaskCount(tasks.length);
		}
	}

	function handleError(event: CustomEvent) {
		error = event.detail;
	}

	function toggleAIChat() {
		showAIChat = !showAIChat;
	}

	function toggleQuickActions() {
		showQuickActions = !showQuickActions;
	}
</script>

<svelte:head>
	<title>{showLandingPage ? 'AI Task Manager - Intelligent Task Management' : 'Task Manager - AI-Powered Task Management'}</title>
	<meta name="description" content={showLandingPage ? 'Transform your task management with AI. Natural language processing meets intelligent task organization.' : 'Manage your tasks with AI assistance. Create, organize, and complete tasks efficiently.'} />
</svelte:head>

{#if showLandingPage}
	<!-- Landing Page for Unauthenticated Users (No Guest Session) -->
	<LandingPage />
{:else}
	<!-- Main Tasks Interface for Authenticated Users and Guest Users -->
	<div class="min-h-screen bg-page-bg">
		<!-- Guest Banner for Guest Users -->
		{#if $isGuestMode && !isAuthenticated}
			<div class="mb-4">
				<GuestBanner 
					taskCount={guestTaskCount}
					daysRemaining={7}
					onSignUp={handleGuestSignUp}
				/>
			</div>
		{/if}

		<!-- Try Guest Mode Button for Unauthenticated Users -->
		{#if !isAuthenticated && !$isGuestMode}
			<div class="mb-6 text-center">
				<button
					onclick={handleGuestRegistration}
					class="bg-accent hover:bg-accent-button-hover text-accent-foreground font-semibold py-3 px-6 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
					disabled={loading}
				>
					{loading ? 'Starting...' : 'Try Without Signing Up'}
				</button>
				<p class="text-sm text-foreground-secondary mt-2">
					Create tasks for 7 days • No account required • Upgrade anytime
				</p>
			</div>
		{/if}
		<!-- Mobile-first single column layout -->
		<div class="max-w-4xl mx-auto">
			
			<!-- Show task interface only if we have a workspace (authenticated or guest) -->
			{#if currentWorkspace}
				<!-- Task Input Section -->
				<div class="mb-6">
					<TaskInputSimple 
						workspaceId={currentWorkspace?.id}
						on:taskCreated={handleTaskCreated}
						on:error={handleError}
					/>
				</div>

				<!-- AI Agent Chat - Collapsible -->
				<div class="mb-6">
					<div class="bg-card-bg border border-subtle-base rounded-xl overflow-hidden">
						<button
							onclick={toggleAIChat}
							class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-raised transition-colors"
						>
							<div class="flex items-center gap-2">
								<Sparkles class="w-5 h-5 text-accent" />
								<span class="font-medium text-foreground-base">AI Assistant</span>
								{#if !showAIChat}
									<span class="text-sm text-foreground-secondary">Ask for help or suggestions</span>
								{/if}
							</div>
							<div class="transform transition-transform {showAIChat ? 'rotate-180' : ''}">
								<svg class="w-5 h-5 text-foreground-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</div>
						</button>
						
						{#if showAIChat}
							<div class="border-t border-subtle-base">
								<AIAgentChatSimple workspaceId={currentWorkspace?.id} />
							</div>
						{/if}
					</div>
				</div>

				<!-- Error Display -->
				{#if error}
					<div class="mb-6 bg-error-alert-bg border border-error-border text-error px-4 py-3 rounded-lg">
						<div class="flex items-center">
							<svg class="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
							</svg>
							<span class="text-sm">{error}</span>
						</div>
					</div>
				{/if}

				<!-- Task List -->
				<div class="mb-6">
					<TaskListSimple 
						{tasks}
						{loading}
						on:taskUpdated={handleTaskUpdated}
						on:taskDeleted={handleTaskDeleted}
						on:error={handleError}
					/>
				</div>

				<!-- Quick Actions - Mobile Floating Action Button -->
				<div class="fixed bottom-20 right-4 md:hidden z-40">
					<div class="relative">
						<!-- Quick Actions Menu -->
						{#if showQuickActions}
							<div class="absolute bottom-16 right-0 bg-surface-base border border-subtle-base rounded-xl shadow-lg p-2 min-w-[200px]">
								<button
									onclick={toggleAIChat}
									class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-raised rounded-lg transition-colors"
								>
									<Sparkles class="w-5 h-5 text-accent" />
									<span class="text-sm font-medium text-foreground-base">
										{showAIChat ? 'Hide AI Assistant' : 'Show AI Assistant'}
									</span>
								</button>
								<button
									onclick={() => {
										loadTasks();
										showQuickActions = false;
									}}
									class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-raised rounded-lg transition-colors"
								>
									<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
									<span class="text-sm font-medium text-foreground-base">Refresh Tasks</span>
								</button>
							</div>
						{/if}

						<!-- Main FAB -->
						<button
							onclick={toggleQuickActions}
							class="w-14 h-14 bg-primary hover:bg-primary-button-hover text-primary-foreground rounded-full shadow-lg flex items-center justify-center transition-all duration-200 {showQuickActions ? 'rotate-45' : ''}"
							aria-label="Quick Actions"
						>
							<Plus class="w-6 h-6" />
						</button>
					</div>
				</div>

				<!-- Desktop Quick Actions -->
				<div class="hidden md:block">
					<div class="bg-card-bg border border-subtle-base rounded-xl p-4">
						<h3 class="font-medium text-foreground-base mb-3">Quick Actions</h3>
						<div class="flex gap-2">
							<button
								onclick={toggleAIChat}
								class="flex items-center gap-2 px-3 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors text-sm"
							>
								<Sparkles class="w-4 h-4" />
								{showAIChat ? 'Hide AI Assistant' : 'Show AI Assistant'}
							</button>
							<button
								onclick={loadTasks}
								class="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								Refresh Tasks
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Account Creation Dialog -->
<AccountCreationDialog
	isOpen={showAccountDialog}
	guestTasks={tasks}
	onClose={() => showAccountDialog = false}
	onCreateAccount={handleAccountCreation}
/>