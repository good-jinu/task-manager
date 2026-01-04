import { writable } from "svelte/store";

// PWA installation state
export const canInstallPWA = writable(false);
export const isInstalled = writable(false);
export const swUpdateAvailable = writable(false);

let deferredPrompt: any = null;

export function initializePWA() {
	if (typeof window === "undefined") return;

	// Check if already installed
	if (window.matchMedia("(display-mode: standalone)").matches) {
		isInstalled.set(true);
	}

	// Listen for beforeinstallprompt event
	window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		deferredPrompt = e;
		canInstallPWA.set(true);
	});

	// Listen for app installed event
	window.addEventListener("appinstalled", () => {
		isInstalled.set(true);
		canInstallPWA.set(false);
		deferredPrompt = null;
	});

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

export async function installPWA(): Promise<boolean> {
	if (!deferredPrompt) return false;

	try {
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === "accepted") {
			canInstallPWA.set(false);
			deferredPrompt = null;
			return true;
		}

		return false;
	} catch (error) {
		console.error("PWA installation failed:", error);
		return false;
	}
}

export function updateServiceWorker(): void {
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.getRegistration().then((registration) => {
			if (registration && registration.waiting) {
				registration.waiting.postMessage({ type: "SKIP_WAITING" });
				swUpdateAvailable.set(false);
			}
		});
	}
}
