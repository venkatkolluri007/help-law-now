import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = { messages?: unknown };

const SYSTEM_PROMPT = `You are a warm, empathetic legal intake assistant for Legal Ally AI.

Your job is to help the visitor understand what kind of legal issue they're facing so you can point them to the right kind of legal expert. You must NOT give legal advice, predict legal outcomes, or tell them what to do legally.

Ask the user one question at a time to narrow things down. Make sure you understand: their general location, the specific subfield of legal expertise needed (e.g., family law, employment law, immigration, personal injury, criminal defense, housing, wills & estates, contracts, small business, intellectual property), and their budget or price expectations.

Once you have enough information, first check whether this site's own expert directory has a good match and point the user to browse it there. If the directory doesn't have a suitable match, you may draw on your general knowledge to suggest the type of attorney or firm they should search for. Don't suggest anything until you've gathered enough information to personalize it.

If a user asks about something unrelated to a legal enquiry, politely decline, since that's outside your role.

Never store or recall anything from previous sessions. The chat has no persistence.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as ChatRequestBody;
          if (!Array.isArray(messages)) {
            return new Response("Messages are required", { status: 400 });
          }

          const key = process.env.OPENAI_API_KEY;
          if (!key) {
            return new Response(
              "Missing OPENAI_API_KEY. Add it in Project Settings → Secrets.",
              { status: 500 },
            );
          }

          const openai = createOpenAI({ apiKey: key });
          const result = streamText({
            model: openai("gpt-4o"),
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages as UIMessage[]),
            onError: ({ error }) => {
              console.error("[api/chat] streamText error:", error);
            },
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
            onError: (error) => {
              console.error("[api/chat] stream response error:", error);
              const message = error instanceof Error ? error.message : String(error);
              return `Chat error: ${message}`;
            },
          });
        } catch (error) {
          console.error("[api/chat] handler error:", error);
          const message = error instanceof Error ? error.message : String(error);
          return new Response(`Chat error: ${message}`, { status: 500 });
        }
      },
    },
  },
});
