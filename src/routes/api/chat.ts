import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

type ChatRequestBody = { messages?: unknown };

const SYSTEM_PROMPT = `You are a warm, empathetic legal intake assistant for Legal Ally AI.

Your job is to help the visitor understand what kind of legal issue they're facing and then point them toward real, currently-practicing legal experts they can contact. You must NOT give legal advice, predict legal outcomes, or tell them what to do legally.

INTAKE
- Ask one question at a time to gather: (1) their general location (city + state/country), (2) the specific subfield of legal expertise needed (e.g., family law, employment, immigration, personal injury, criminal defense, housing, wills & estates, contracts, small business, IP), and (3) their budget or price expectations.
- Do not suggest attorneys until you have all three.

FINDING ATTORNEYS (primary behavior)
- Once you have location + specialty + budget, USE THE web_search_preview TOOL to search the live web for real attorneys or firms matching the criteria.
- Prefer legitimate attorney directories and sources: Avvo, Martindale-Hubbell, FindLaw, Justia, Super Lawyers, state bar association directories, and the firms' own websites.
- Return 2–4 real suggestions. For each: **Name** — Firm, one-line relevant detail (specialty focus, location, notable credential if visible), and a real clickable markdown link to their profile page or firm site (URLs must come from the search results, never invented).
- You may also mention that our own "Quick Pick" directory on this site is available to browse, but this should be secondary — the primary value is the real, linked search results.

GUARDRAILS
- No legal advice, no outcome predictions, no fee quotes.
- Always close attorney suggestions with a brief note that these are a starting point for their own research — they should independently verify credentials, bar standing, reviews, and fit before hiring, and that this is not a professional referral.
- If a user asks about something unrelated to a legal enquiry, politely decline.
- Never store or recall anything from previous sessions. The chat has no persistence.`;

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
            model: openai.responses("gpt-4o"),
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages as UIMessage[]),
            tools: {
              web_search_preview: openai.tools.webSearchPreview({}),
            },
            stopWhen: stepCountIs(50),
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
