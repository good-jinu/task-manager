<script lang="ts">
	import type { ExternalIntegration } from '@notion-task-manager/db';
	import IntegrationToggle from './IntegrationToggle.svelte';
	import NotionIntegrationDialog from './NotionIntegrationDialog.svelte';
	import { Button } from './ui';
	import { Close, Database, KeyboardArrowRight } from './icons';
	import { cn } from './utils';

	interface NotionDatabase {
		id: string;
		name: string;
		url?: string;
	}

	interface Props {
		isOpen: boolean;
		workspaceId: string;
		integrations?: ExternalIntegration[];
		onClose: () => void;
		onToggleIntegration: (provider: string, enabled: boolean) => Promise<void>;
		onConnectNotion: (databaseId: string, importExisting: boolean) => Promise<void>;
		onDisconnectIntegration: (integrationId: string) => Promise<void>;
		class?: string;
	}

	let {
		isOpen,
		workspaceId,
		integrations = [],
		onClose,
		onToggleIntegration,
		onConnectNotion,
		onDisconnectIntegration,
		class: className = ''
	}: Props = $props();

	let showNotionDialog = $state(false);
	let availableDatabases = $state<NotionDatabase[]>([]);
	let loadingDatabases = $state(false);

	// Find Notion integration
	const notionIntegration = $derived(
		integrations.find(i => i.provider === 'notion')
	);

	// Prevent background scroll when drawer is open
	$effect(() => {
		if (typeof document === 'undefined') return;
		
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}

		return () => {
			document.body.style.overflow = '';
		};
	});

	async function handleNotionToggle(enabled: boolean) {
		if (enabled && !notionIntegration) {
			// Need to connect - show dialog
			await loadNotionDatabases();
			showNotionDialog = true;
		} else if (notionIntegration) {
			// Toggle existing integration
			await onToggleIntegration('notion', enabled);
		}
	}

	async function loadNotionDatabases() {
		loadingDatabases = true;
		try {
			// In a real implementation, this would fetch from Notion API
			// For now, we'll simulate some databases
			await new Promise(resolve => setTimeout(resolve, 1000));
			availableDatabases = [
				{ id: 'db1', name: 'Personal Tasks', url: 'https://notion.so/...' },
				{ id: 'db2', name: 'Work Projects', url: 'https://notion.so/...' },
				{ id: 'db3', name: 'Ideas & Notes', url: 'https://notion.so/...' }
			];
		} catch (error) {
			console.error('Failed to load databases:', error);
			availableDatabases = [];
		} finally {
			loadingDatabases = false;
		}
	}

	function handleConfigureNotion() {
		loadNotionDatabases();
		showNotionDialog = true;
	}

	async function handleDisconnectNotion() {
		if (notionIntegration) {
			await onDisconnectIntegration(notionIntegration.id);
		}
	}

	function handleCloseNotionDialog() {
		showNotionDialog = false;
	}

	async function handleConnectNotionDatabase(databaseId: string, importExisting: boolean) {
		await onConnectNotion(databaseId, importExisting);
		showNotionDialog = false;
	}
</script>

<!-- Backdrop -->
{#if isOpen}
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 z-40"
		onclick={onClose}
	></div>
{/if}

<!-- Drawer -->
<div class={cn(
	'fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50',
	'transform transition-transform duration-300 ease-in-out',
	'overflow-y-auto',
	isOpen ? 'translate-x-0' : 'translate-x-full',
	className
)}>
	<!-- Header -->
	<div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-900">Settings</h2>
			<button
				onclick={onClose}
				class={cn(
					'p-2 rounded-md text-gray-400 hover:text-gray-600',
					'hover:bg-gray-100 transition-colors',
					'min-w-[44px] min-h-[44px] flex items-center justify-center'
				)}
				aria-label="Close settings"
			>
				<Close class="w-5 h-5" />
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="p-6 space-y-8">
		<!-- Integrations Section -->
		<section>
			<h3 class="text-base font-medium text-gray-900 mb-4">Integrations</h3>
			<div class="space-y-4">
				<!-- Notion Integration -->
				<IntegrationToggle
					integration={notionIntegration}
					onToggle={handleNotionToggle}
					onConfigure={notionIntegration ? handleConfigureNotion : undefined}
				/>

				{#if notionIntegration}
					<!-- Additional Notion controls -->
					<div class="ml-9 space-y-2">
						<button
							onclick={handleConfigureNotion}
							class={cn(
								'flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700',
								'min-h-[44px] px-2'
							)}
						>
							<Database class="w-4 h-4" />
							Change Database
							<KeyboardArrowRight class="w-4 h-4" />
						</button>
						
						<button
							onclick={handleDisconnectNotion}
							class={cn(
								'flex items-center gap-2 text-sm text-red-600 hover:text-red-700',
								'min-h-[44px] px-2'
							)}
						>
							Disconnect Notion
						</button>
					</div>
				{/if}

				<!-- Future integrations placeholder -->
				<div class="opacity-50 pointer-events-none">
					<div class="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
						<div class="flex items-center gap-3">
							<div class="w-6 h-6 bg-gray-300 rounded"></div>
							<div>
								<h4 class="font-medium text-gray-700">Google Calendar</h4>
								<p class="text-sm text-gray-500">Coming soon</p>
							</div>
						</div>
						<div class="w-11 h-6 bg-gray-200 rounded-full"></div>
					</div>
				</div>

				<div class="opacity-50 pointer-events-none">
					<div class="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
						<div class="flex items-center gap-3">
							<div class="w-6 h-6 bg-gray-300 rounded"></div>
							<div>
								<h4 class="font-medium text-gray-700">Slack</h4>
								<p class="text-sm text-gray-500">Coming soon</p>
							</div>
						</div>
						<div class="w-11 h-6 bg-gray-200 rounded-full"></div>
					</div>
				</div>
			</div>
		</section>

		<!-- Workspace Section -->
		<section>
			<h3 class="text-base font-medium text-gray-900 mb-4">Workspace</h3>
			<div class="space-y-3">
				<div class="text-sm text-gray-600">
					<span class="font-medium">Workspace ID:</span>
					<code class="ml-2 px-2 py-1 bg-gray-100 rounded text-xs font-mono">
						{workspaceId}
					</code>
				</div>
				
				<!-- Future workspace settings -->
				<div class="opacity-50">
					<p class="text-sm text-gray-500">More workspace settings coming soon</p>
				</div>
			</div>
		</section>

		<!-- Account Section -->
		<section>
			<h3 class="text-base font-medium text-gray-900 mb-4">Account</h3>
			<div class="space-y-3">
				<Button variant="outline" class="w-full justify-start" disabled>
					Export Data
				</Button>
				<Button variant="outline" class="w-full justify-start text-red-600 border-red-200 hover:bg-red-50" disabled>
					Delete Account
				</Button>
				<p class="text-xs text-gray-500">Account management features coming soon</p>
			</div>
		</section>
	</div>
</div>

<!-- Notion Integration Dialog -->
<NotionIntegrationDialog
	isOpen={showNotionDialog}
	{workspaceId}
	{availableDatabases}
	loading={loadingDatabases}
	onClose={handleCloseNotionDialog}
	onConnect={handleConnectNotionDatabase}
/>