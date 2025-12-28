<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
</script>

<svelte:head>
	<title>Sign In - Notion Task Manager</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<div>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
				Sign in to your account
			</h2>
			<p class="mt-2 text-center text-sm text-gray-600">
				Connect with your Notion workspace to manage your tasks
			</p>
		</div>
		<div class="mt-8 space-y-6">
			<button
				onclick={() => signIn('notion')}
				class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			>
				<span class="absolute left-0 inset-y-0 flex items-center pl-3">
					<svg class="h-5 w-5 text-indigo-500 group-hover:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
					</svg>
				</span>
				Sign in with Notion
			</button>
		</div>
	</div>
</div>