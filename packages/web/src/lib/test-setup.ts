import { vi } from "vitest";

// Mock document.cookie for guest user tests
Object.defineProperty(document, "cookie", {
	writable: true,
	value: "",
});

// Mock window.location for navigation tests
Object.defineProperty(window, "location", {
	writable: true,
	value: {
		href: "http://localhost:3000",
		reload: vi.fn(),
	},
});
