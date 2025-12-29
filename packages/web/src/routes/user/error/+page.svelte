<script lang="ts">
	import { page } from '$app/state';
	
	$: error = page.url.searchParams.get('error');
	
	function getErrorMessage(error: string | null): string {
		switch (error) {
			case 'Configuration':
				return 'There is a problem with the server configuration.';
			case 'AccessDenied':
				return 'Access denied. You do not have permission to sign in.';
			case 'Verification':
				return 'The verification token has expired or has already been used.';
			case 'OAuthSignin':
				return 'Error in constructing an authorization URL.';
			case 'OAuthCallback':
				return 'Error in handling the response from an OAuth provider.';
			case 'OAuthCreateAccount':
				return 'Could not create OAuth provider user in the database.';
			case 'EmailCreateAccount':
				return 'Could not create email provider user in the database.';
			case 'Callback':
				return 'Error in the OAuth callback handler route.';
			case 'OAuthAccountNotLinked':
				return 'The email on the account is already linked, but not with this OAuth account.';
			case 'EmailSignin':
				return 'Sending the e-mail with the verification token failed.';
			case 'CredentialsSignin':
				return 'The authorize callback returned null in the Credentials provider.';
			case 'SessionRequired':
				return 'The content of this page requires you to be signed in at all times.';
			default:
				return 'An unexpected error occurred during authentication.';
		}
	}
</script>

<svelte:head>
	<title>Authentication Error - Notion Task Manager</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<div>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
				Authentication Error
			</h2>
			<div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-red-800">
							{getErrorMessage(error)}
						</h3>
					</div>
				</div>
			</div>
		</div>
		<div class="mt-8 space-y-6">
			<a
				href="/user/signin"
				class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			>
				Try Again
			</a>
			<a
				href="/"
				class="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			>
				Go Home
			</a>
		</div>
	</div>
</div>