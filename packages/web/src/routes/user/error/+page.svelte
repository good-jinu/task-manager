<script lang="ts">
import { page } from "$app/state";
import { Alert, Button, Card } from "$lib/components/ui";

$: error = page.url.searchParams.get("error");

function getErrorMessage(error: string | null): string {
	switch (error) {
		case "Configuration":
			return "There is a problem with the server configuration.";
		case "AccessDenied":
			return "Access denied. You do not have permission to sign in.";
		case "Verification":
			return "The verification token has expired or has already been used.";
		case "OAuthSignin":
			return "Error in constructing an authorization URL.";
		case "OAuthCallback":
			return "Error in handling the response from an OAuth provider.";
		case "OAuthCreateAccount":
			return "Could not create OAuth provider user in the database.";
		case "EmailCreateAccount":
			return "Could not create email provider user in the database.";
		case "Callback":
			return "Error in the OAuth callback handler route.";
		case "OAuthAccountNotLinked":
			return "The email on the account is already linked, but not with this OAuth account.";
		case "EmailSignin":
			return "Sending the e-mail with the verification token failed.";
		case "CredentialsSignin":
			return "The authorize callback returned null in the Credentials provider.";
		case "SessionRequired":
			return "The content of this page requires you to be signed in at all times.";
		default:
			return "An unexpected error occurred during authentication.";
	}
}
</script>

<svelte:head>
	<title>Authentication Error - Notion Task Manager</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-page-bg py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<div>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-foreground-base">
				Authentication Error
			</h2>
			<Alert variant="error" title="Authentication Failed" class="mt-4">
				{getErrorMessage(error)}
			</Alert>
		</div>
		<Card class="space-y-4">
			<Button href="/user/signin" variant="primary" size="lg" class="w-full">
				Try Again
			</Button>
			<Button href="/" variant="outline" size="lg" class="w-full">
				Go Home
			</Button>
		</Card>
	</div>
</div>