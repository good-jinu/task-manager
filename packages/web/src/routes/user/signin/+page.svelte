<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { Button, Card } from '$lib/components/ui';
</script>

<svelte:head>
	<title>Sign In - Notion Task Manager</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<div>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-foreground">
				Sign in to your account
			</h2>
			<p class="mt-2 text-center text-sm text-foreground-secondary">
				Connect with your Notion workspace to manage your tasks
			</p>
		</div>
		<Card>
			<Button
				onclick={() => signIn('notion')}
				variant="primary"
				size="lg"
				class="w-full"
			>
				<span class="absolute left-0 inset-y-0 flex items-center pl-3">
					<svg class="h-5 w-5 text-primary2 group-hover:text-primary3" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
					</svg>
				</span>
				Sign in with Notion
			</Button>
		</Card>
	</div>
</div>