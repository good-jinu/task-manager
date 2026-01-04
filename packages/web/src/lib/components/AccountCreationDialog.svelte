<script lang="ts">
	import type { Task } from '@notion-task-manager/db';
	import { Button, Card } from './ui';
	import { Close, Check, ArrowRightAlt, Spinner } from './icons';
	import { cn } from './utils';

	interface Props {
		isOpen: boolean;
		guestTasks?: Task[];
		onClose: () => void;
		onCreateAccount: (migrateData: boolean) => Promise<void>;
		class?: string;
	}

	let {
		isOpen,
		guestTasks = [],
		onClose,
		onCreateAccount,
		class: className = ''
	}: Props = $props();

	let migrateData = $state(true);
	let isCreating = $state(false);
	let step = $state<'confirm' | 'creating' | 'success'>('confirm');

	// Reset state when dialog opens/closes
	$effect(() => {
		if (isOpen) {
			step = 'confirm';
			migrateData = true;
			isCreating = false;
		}
	});

	async function handleCreateAccount() {
		if (isCreating) return;

		isCreating = true;
		step = 'creating';

		try {
			await onCreateAccount(migrateData);
			step = 'success';
			
			// Auto-close after success
			setTimeout(() => {
				onClose();
			}, 2000);
		} catch (error) {
			console.error('Account creation failed:', error);
			step = 'confirm';
			// Could show error message here
		} finally {
			isCreating = false;
		}
	}

	function handleClose() {
		if (!isCreating) {
			onClose();
		}
	}

	// Prevent background scroll when dialog is open
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
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
		onclick={handleClose}
	>
		<!-- Dialog -->
		<Card
			variant="elevated"
			padding="lg"
			class={cn(
				'w-full max-w-md mx-auto',
				'animate-in fade-in-0 zoom-in-95 duration-200',
				className
			)}
			onclick={(e) => e.stopPropagation()}
		>
			{#if step === 'confirm'}
				<!-- Header -->
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-xl font-semibold text-gray-900">
						Create Your Account
					</h2>
					<button
						onclick={handleClose}
						class={cn(
							'p-2 rounded-md text-gray-400 hover:text-gray-600',
							'hover:bg-gray-100 transition-colors',
							'min-w-[44px] min-h-[44px] flex items-center justify-center'
						)}
						aria-label="Close dialog"
					>
						<Close class="w-5 h-5" />
					</button>
				</div>

				<!-- Content -->
				<div class="space-y-6">
					<!-- Benefits -->
					<div>
						<h3 class="text-sm font-medium text-gray-900 mb-3">
							Account Benefits
						</h3>
						<ul class="space-y-2 text-sm text-gray-600">
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-green-500 flex-shrink-0" />
								<span>Keep your tasks permanently</span>
							</li>
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-green-500 flex-shrink-0" />
								<span>Sync with Notion databases</span>
							</li>
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-green-500 flex-shrink-0" />
								<span>Access from multiple devices</span>
							</li>
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-green-500 flex-shrink-0" />
								<span>Advanced AI features</span>
							</li>
						</ul>
					</div>

					<!-- Migration option -->
					{#if guestTasks.length > 0}
						<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
							<div class="flex items-start gap-3">
								<input
									id="migrate-data"
									type="checkbox"
									bind:checked={migrateData}
									class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
								<div>
									<label for="migrate-data" class="text-sm font-medium text-blue-900 cursor-pointer">
										Transfer your {guestTasks.length} task{guestTasks.length === 1 ? '' : 's'}
									</label>
									<p class="text-xs text-blue-700 mt-1">
										Your current tasks will be moved to your new account
									</p>
								</div>
							</div>
						</div>
					{/if}

					<!-- Actions -->
					<div class="flex flex-col sm:flex-row gap-3">
						<Button
							onclick={handleCreateAccount}
							variant="primary"
							class="flex-1"
							disabled={isCreating}
						>
							<span class="flex items-center justify-center gap-2">
								Create Account
								<ArrowRightAlt class="w-4 h-4" />
							</span>
						</Button>
						<Button
							onclick={handleClose}
							variant="outline"
							disabled={isCreating}
						>
							Cancel
						</Button>
					</div>
				</div>

			{:else if step === 'creating'}
				<!-- Creating state -->
				<div class="text-center py-8">
					<Spinner class="w-8 h-8 mx-auto mb-4 text-blue-600" />
					<h3 class="text-lg font-medium text-gray-900 mb-2">
						Creating Your Account
					</h3>
					<p class="text-sm text-gray-600">
						{#if migrateData && guestTasks.length > 0}
							Transferring your {guestTasks.length} task{guestTasks.length === 1 ? '' : 's'}...
						{:else}
							Setting up your workspace...
						{/if}
					</p>
				</div>

			{:else if step === 'success'}
				<!-- Success state -->
				<div class="text-center py-8">
					<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<Check class="w-8 h-8 text-green-600" />
					</div>
					<h3 class="text-lg font-medium text-gray-900 mb-2">
						Account Created!
					</h3>
					<p class="text-sm text-gray-600">
						{#if migrateData && guestTasks.length > 0}
							Your {guestTasks.length} task{guestTasks.length === 1 ? ' has' : 's have'} been transferred successfully.
						{:else}
							Welcome to your new task management workspace!
						{/if}
					</p>
				</div>
			{/if}
		</Card>
	</div>
{/if}

<style>
	@keyframes animate-in {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.animate-in {
		animation: animate-in 0.2s ease-out;
	}
</style>