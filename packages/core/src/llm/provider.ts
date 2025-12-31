import { createDeepInfra } from "@ai-sdk/deepinfra";
import type { LanguageModel } from "ai";

export function createProvider() {
	return createDeepInfra({
		apiKey: process.env.DEEPINFRA_API_KEY,
	});
}

export function getModel(): LanguageModel {
	const provider = createProvider();
	return provider(process.env.DEEPINFRA_MODEL || "Qwen/QwQ-32B-Preview");
}
