import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = { messages?: unknown };

const SYSTEM_PROMPT = `You are a warm, empathetic legal triage assistant for a service called JustLegal.

Your only job is to help the visitor understand what kind of legal issue they may be facing and point them toward the right type of legal expert. You must NOT give legal advice, predict outcomes, or tell them what to do legally.

Keep your responses concise, supportive, and easy to read. If the user describes a situation, ask one or two clarifying questions, then suggest the most relevant legal specialty (e.g., family law, employment law, immigration, personal injury, criminal defense, housing, wills & estates, contracts, small business, intellectual property). End by encouraging them to browse the expert directory on the page.

Never store or recall anything from previous sessions. The chat has no persistence.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.OPENAI_API_KEY;
        if (!key) {
          return new Response("Missing OPENAI_API_KEY", { status: 500 });
        }

        const openai = createOpenAI({ apiKey: key });
        const result = streamText({
          model: openai("gpt-4o"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
