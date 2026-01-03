<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { Button, Card } from '$lib/components/ui';
	import { Lock } from '$lib/components/icons';
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
					<Lock class="h-5 w-5 text-primary2 group-hover:text-primary3" />
				</span>
				Sign in with Notion
			</Button>
		</Card>
	</div>
</div>