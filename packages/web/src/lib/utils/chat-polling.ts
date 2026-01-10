/**
 * Utility for polling chat results
 */
export async function pollChatResult(
	chatId: string,
	onComplete: (result: any) => void,
	onError: (error: string) => void,
) {
	const maxAttempts = 30; // 5 minutes with 10-second intervals
	let attempts = 0;

	const poll = async () => {
		try {
			const response = await fetch(`/api/ai/chat/${chatId}/status`);
			const result = await response.json();

			if (result.completed) {
				onComplete(result);
				return;
			}

			attempts++;
			if (attempts < maxAttempts) {
				setTimeout(poll, 10000); // Poll every 10 seconds
			} else {
				onError("Request timed out");
			}
		} catch (error) {
			onError(error instanceof Error ? error.message : "Polling failed");
		}
	};

	poll();
}

/**
 * Send message to AI chat API
 */
export async function sendChatMessage(
	message: string,
	workspaceId: string,
	contextTasks: any[],
) {
	const response = await fetch("/api/ai/chat", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			message,
			workspaceId,
			contextTasks,
		}),
	});

	return response.json();
}
