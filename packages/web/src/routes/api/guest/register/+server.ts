import { GuestUserService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const guestUserService = new GuestUserService();

export const POST: RequestHandler = async ({ cookies }) => {
	try {
		// Check if user already has a guest ID
		const existingGuestId = cookies.get("guest-id");
		if (existingGuestId?.startsWith("guest_")) {
			// Return existing guest user info
			const guestUser = await guestUserService.getGuestUser(existingGuestId);
			if (guestUser) {
				const workspace =
					await guestUserService.createGuestWorkspace(existingGuestId);
				return json({
					success: true,
					data: {
						guestId: existingGuestId,
						workspace,
					},
				});
			}
		}

		// Create new guest user
		const guestUser = await guestUserService.createGuestUser();
		const workspace = await guestUserService.createGuestWorkspace(guestUser.id);

		// Set guest ID cookie (expires in 1 year)
		cookies.set("guest-id", guestUser.id, {
			path: "/",
			maxAge: 365 * 24 * 60 * 60, // 1 year
			httpOnly: false, // Allow client-side access for guest mode detection
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
		});

		return json({
			success: true,
			data: {
				guestId: guestUser.id,
				workspace,
			},
		});
	} catch (error) {
		console.error("Failed to register guest user:", error);
		return json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to register guest user",
			},
			{ status: 500 },
		);
	}
};
