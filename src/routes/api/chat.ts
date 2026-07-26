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

INTAKE
Ask ONE question at a time. Skip any item the user has already told you unprompted — do not re-ask. Gather all of the following before making suggestions:
- Location (city + state/country)
- Specific subfield of legal expertise needed (family law, employment, immigration, personal injury, criminal defense, housing, wills & estates, contracts, small business, IP, etc.)
- Budget or price expectations
- What happened, in the user's own words (plain-language description, chronological if possible)
- When it happened (date or timeframe)
- Other parties involved (roles; only names/identifying details if the user offers them)
- Any injuries or damages (physical, financial, emotional, professional)
- Evidence or documents the user has available (contracts, messages, photos, reports, receipts, etc.)
- Desired outcome (what they want to achieve)
- Any urgency or deadline (court dates, statute-of-limitations concerns, time pressure)

Keep going until you have enough substance for a useful summary. Don't rush and don't ask more than one thing at a time.

WHEN YOU HAVE ENOUGH DETAIL
1. FIRST use the web_search_preview tool to find real attorneys matching location + specialty + budget. Prefer Avvo, Martindale-Hubbell, FindLaw, Justia, Super Lawyers, state bar directories, and the firms' own websites. You MUST name specific individual attorneys — if a search returns only a firm, run a follow-up search on that firm's team page to name a real lawyer; otherwise drop that firm.
2. THEN call the \`generate_incident_summary\` tool EXACTLY ONCE with a fully-populated structured object using the fields defined by the tool schema. Use only facts the user gave you. Neutral, factual tone. No legal conclusions. Include 2–4 suggested attorneys pulled from your live search results, each with a real link.
3. THEN reply in chat with a short confirmation that a downloadable incident summary is ready above, and repeat the attorney suggestions in this exact readable shape:
   - **Attorney Name** — Title / role, Practice area focus
     - Firm: [Firm Name](https://firm-website-or-profile-link)
     - Location: City, State
     - Why they fit: one short sentence
   Every name, title, firm, and URL must come from live search results — never invent.

GUARDRAILS
- No legal advice, no outcome predictions, no fee quotes.
- Close attorney suggestions with a brief note that these are a starting point for the user's own research — they should independently verify credentials, bar standing, reviews, and fit before hiring, and this is not a professional referral.
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
                  "Emit a finalized, structured incident-summary document the user can download and share with an attorney. Call this exactly once, after gathering enough detail and running the web search for attorneys.",
                inputSchema: z.object({
                  title: z
                    .string()
                    .describe(
                      "Short human-readable title, e.g. 'Incident Summary — Wrongful Termination, Austin TX'.",
                    ),
                  situationSummary: z
                    .string()
                    .describe("Plain-language summary of what happened."),
                  dateTimeframe: z
                    .string()
                    .describe("When it happened. Use the user's phrasing if a specific date is unknown."),
                  location: z
                    .string()
                    .describe("City, state/country where the incident occurred or the user is based."),
                  partiesInvolved: z
                    .string()
                    .describe("Other people, employers, businesses, agencies involved and their roles."),
                  injuriesDamages: z
                    .string()
                    .describe("Physical, financial, emotional, or professional harm the user has suffered."),
                  evidenceAvailable: z
                    .string()
                    .describe("Documents, messages, photos, reports, receipts, or other evidence the user has."),
                  desiredOutcome: z
                    .string()
                    .describe("What the user wants to achieve."),
                  urgencyDeadline: z
                    .string()
                    .describe("Court dates, statute concerns, or other time pressure. Write 'None stated' if the user didn't mention any."),
                  budget: z
                    .string()
                    .describe("The user's stated budget or price expectations."),
                  areaOfLaw: z
                    .string()
                    .describe("Legal subfield, e.g. 'Family law', 'Employment', 'Personal injury'."),
                  suggestedAttorneys: z
                    .array(
                      z.object({
                        name: z.string().describe("Individual attorney's name."),
                        firm: z.string().describe("Firm name."),
                        location: z.string().describe("City, state."),
                        source: z
                          .string()
                          .describe("Where this was found, e.g. 'Avvo', 'Firm website', 'Martindale-Hubbell'."),
                        link: z.string().describe("Working URL to the attorney's profile or firm page."),
                      }),
                    )
                    .describe("2–4 real attorneys pulled from the live web search."),
                }),
                execute: async (input) => input,
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
