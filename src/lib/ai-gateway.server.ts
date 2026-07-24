import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Lovable AI Gateway provider for server-side model calls.
 * Replace this with your own legal-agent backend when you're ready.
 */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://api.lovable.ai/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
