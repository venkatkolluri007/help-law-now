import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";

type ChatRequestBody = { messages?: unknown };

const SYSTEM_PROMPT = `You are a warm, empathetic legal intake assistant for Ally AI.

Your job has two goals:
1. Help the visitor understand what kind of legal issue they're facing.
2. Produce a clear, well-organized incident-summary document they can hand to a lawyer, alongside real attorney suggestions.

You must NOT give legal advice, predict legal outcomes, or tell them what to do legally.

INTAKE (ask ONE question at a time, in this order)
- Location (city + state/country)
- Specific subfield of legal expertise needed (e.g., family law, employment, immigration, personal injury, criminal defense, housing, wills & estates, contracts, small business, IP)
- Budget or price expectations
- A clear picture of the incident/situation itself. Probe gently for:
  • What happened, in the user's own words (chronological if possible)
  • Key dates and timeline
  • People and organizations involved (roles, not identifying details unless the user offers them)
  • Documents, contracts, messages, or evidence the user has
  • Harm or impact suffered (financial, physical, emotional, professional)
  • What the user wants to achieve (outcome/goal)
  • Any deadlines, court dates, or time pressure
  • Anything the user has already tried

Ask follow-ups until you have enough substance for a useful summary. Don't rush.

WHEN YOU HAVE ENOUGH DETAIL
1. FIRST call the \`generate_incident_summary\` tool exactly once, passing a thorough markdown document. Structure it with these sections:
   # Incident Summary
   **Prepared for:** legal consultation
   **Date prepared:** <today's date>
   **Location:** <city, state>
   **Area of law:** <specialty>
   ## Overview
   ## Timeline of Events
   ## Parties Involved
   ## Evidence & Documents
   ## Harm / Impact
   ## Desired Outcome
   ## Deadlines & Time Pressure
   ## Steps Already Taken
   ## Open Questions for the Attorney
   Use only facts the user gave you. Neutral, factual tone. No legal conclusions.
2. THEN use the web_search_preview tool to search the live web for real attorneys or firms matching location + specialty + budget. Prefer Avvo, Martindale-Hubbell, FindLaw, Justia, Super Lawyers, state bar directories, and firms' own websites.
3. THEN reply in chat with a short confirmation that a downloadable summary is ready above, followed by 2–4 real suggestions in this exact shape:
   - **Attorney Name** — Title / role, Practice area focus
     - Firm: [Firm Name](https://firm-website-or-profile-link)
     - Location: City, State
     - Why they fit: one short sentence
   Every name, title, firm, and URL must come from live search results — never invent. If a search returns only a firm, run a follow-up search on that firm's team page to name a real individual attorney; otherwise drop that firm.

GUARDRAILS
- No legal advice, no outcome predictions, no fee quotes.
- Close attorney suggestions with a brief note that these are a starting point — the user should independently verify credentials, bar standing, reviews, and fit, and this is not a professional referral.
- If a user asks about something unrelated to a legal enquiry, politely decline.
- Never store or recall anything from previous sessions.`;

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
              generate_incident_summary: tool({
                description:
                  "Emit a finalized, well-structured markdown incident-summary document the user can download and share with an attorney. Call this exactly once, after gathering enough detail, before recommending attorneys.",
                inputSchema: z.object({
                  title: z
                    .string()
                    .describe(
                      "Short human-readable title, e.g. 'Incident Summary — Wrongful Termination, Austin TX'.",
                    ),
                  markdown: z
                    .string()
                    .describe(
                      "The full incident summary as GitHub-flavored markdown. Include all sections from the system prompt.",
                    ),
                }),
                execute: async ({ title, markdown }) => ({ title, markdown }),
              }),
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
