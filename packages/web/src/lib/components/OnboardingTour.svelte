<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from './ui';
	import { Home, Plus, Settings, Sparkles, Close, Check } from './icons';
	import { cn } from './utils';
	import { browser } from '$app/environment';

	interface Props {
		onComplete?: () => void;
	}

	let { onComplete }: Props = $props();

	let currentStep = $state(0);
	let isVisible = $state(false);

	const steps = [
		{
			title: "Welcome to TaskFlow!",
			description: "Manage your tasks efficiently with AI assistance. Let's take a quick tour of your new workspace.",
			icon: Home,
			color: "text-primary",
			bg: "bg-primary/10"
		},
		{
			title: "Create Your First Task",
			description: "Use the 'Add Task' button to quickly jot down what you need to do. You can add titles, descriptions, and more.",
			icon: Plus,
			color: "text-success",
			bg: "bg-success/10",
			highlight: "[data-tour='add-task']"
		},
		{
			title: "AI-Powered Assistance",
			description: "Use the AI input at the bottom to ask for help, summarize tasks, or even generate new ones automatically.",
			icon: Sparkles,
			color: "text-accent",
			bg: "bg-accent/10",
			highlight: "[data-tour='ai-input']"
		},
		{
			title: "Customize & Sync",
			description: "Open settings to connect Notion, manage your workspaces, or create an account to save your tasks permanently.",
			icon: Settings,
			color: "text-info",
			bg: "bg-info/10",
			highlight: "[data-tour='settings']"
		}
	];

	const step = $derived(steps[currentStep]);
	const Icon = $derived(step.icon);

	onMount(() => {
		// Small delay to ensure page is rendered
		const timer = setTimeout(() => {
			isVisible = true;
		}, 1000);
		return () => clearTimeout(timer);
	});

	function nextStep() {
		if (currentStep < steps.length - 1) {
			currentStep++;
		} else {
			complete();
		}
	}

	function prevStep() {
		if (currentStep > 0) {
			currentStep--;
		}
	}

	function complete() {
		isVisible = false;
		if (browser) {
			localStorage.setItem('taskflow_tour_completed', 'true');
		}
		onComplete?.();
	}
</script>

{#if isVisible}
	<div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background-base/60 backdrop-blur-sm animate-in fade-in duration-300">
		<div class="relative w-full max-w-md bg-surface-base rounded-2xl border border-subtle-base shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-300">
			<!-- Close button -->
			<button
				onclick={complete}
				class="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground-base hover:bg-surface-muted rounded-full transition-colors"
			>
				<Close class="w-4 h-4" />
			</button>

			<!-- Step Content -->
			<div class="flex flex-col items-center text-center">
				<div class={cn("w-20 h-20 rounded-2xl flex items-center justify-center mb-6", step.bg)}>
					<Icon class={cn("w-10 h-10", step.color)} />
				</div>

				<h2 class="text-2xl font-bold text-foreground-base mb-3">
					{step.title}
				</h2>

				<p class="text-foreground-secondary leading-relaxed mb-8">
					{step.description}
				</p>

				<!-- Progress Dots -->
				<div class="flex gap-2 mb-8">
					{#each steps as _, i}
						<div class={cn(
							"w-2 h-2 rounded-full transition-all duration-300",
							i === currentStep ? "w-6 bg-primary" : "bg-subtle-base"
						)}></div>
					{/each}
				</div>

				<!-- Navigation -->
				<div class="flex gap-3 w-full">
					{#if currentStep > 0}
						<Button
							variant="outline"
							onclick={prevStep}
							class="flex-1 rounded-xl"
						>
							Back
						</Button>
					{/if}

					<Button
						variant="primary"
						onclick={nextStep}
						class="flex-[2] rounded-xl font-bold"
					>
						{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
