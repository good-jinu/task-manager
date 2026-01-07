import { writable } from "svelte/store";

// Service worker update state
export const swUpdateAvailable = writable(false);

export function initializePWA() {
	if (typeof window === "undefined") return;

	// Register service worker manually for better control
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker
			.register("/sw.js")
			.then((registration) => {
				console.log("Service Worker registered:", registration);

				// Check for updates
				registration.addEventListener("updatefound", () => {
					const newWorker = registration.installing;
					if (newWorker) {
						newWorker.addEventListener("statechange", () => {
							if (
								newWorker.state === "installed" &&
								navigator.serviceWorker.controller
							) {
								swUpdateAvailable.set(true);
							}
						});
					}
				});
			})
			.catch((error) => {
				console.error("Service Worker registration failed:", error);
			});

		// Listen for service worker messages
		navigator.serviceWorker.addEventListener("message", (event) => {
			if (event.data && event.data.type === "SW_ACTIVATED") {
				console.log("Service Worker activated");
			}
		});
	}
}

export function updateServiceWorker(): void {
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.getRegistration().then((registration) => {
			if (registration?.waiting) {
				registration.waiting.postMessage({ type: "SKIP_WAITING" });
				swUpdateAvailable.set(false);
			}
		});
	}
}
