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

WHEN YOU HAVE ENOUGH DETAIL — follow these steps in this exact order. Do NOT skip step 2.
1. FIRST use the web_search_preview tool to find real attorneys matching location + specialty + budget. Prefer Avvo, Martindale-Hubbell, FindLaw, Justia, Super Lawyers, state bar directories, and the firms' own websites. You MUST name specific individual attorneys — if a search returns only a firm, run a follow-up search on that firm's team page to name a real lawyer; otherwise drop that firm. Run multiple searches if needed until you have 2–4 real named attorneys with URLs you actually observed in tool output.

   ABSOLUTE ANTI-FABRICATION RULES — non-negotiable:
   - Every attorney name, firm name, and URL you emit MUST come verbatim from a web_search_preview result you actually received in this conversation. If you did not see it in a tool result, you do not have it.
   - NEVER invent, guess, extrapolate, or "construct" a URL. No placeholder or pattern-based IDs (e.g. /123456, /654321, /profile/First-Last, /attorneys/{zip}-{state}-{name}-{id}.html). If you find yourself typing a URL you didn't literally copy from a search result, stop.
   - NEVER pair a real firm with a made-up attorney name, or a real attorney with a guessed profile URL. Only emit an attorney if BOTH the name and a link to that specific attorney (or their firm's team/bio page naming them) appeared in your search results.
   - Common Western given+surname combinations (John Smith, Emily Johnson, Michael Brown, etc.) paired with generic firm names (Smith & Associates, Johnson Law Firm, Brown & Partners) are a strong signal you are hallucinating. Discard and re-search.
   - If after multiple searches you cannot find 2 real named attorneys with verifiable URLs, call generate_incident_summary with an empty suggestedAttorneys array rather than fabricating entries.

2. THEN you MUST call the \`generate_incident_summary\` tool EXACTLY ONCE with a fully-populated structured object using the fields defined by the tool schema, including the 2–4 suggested attorneys pulled from your live search results (each with a real link you observed). This step is mandatory — do NOT recommend attorneys in chat text without first calling this tool. Use only facts the user gave you. Neutral, factual tone. No legal conclusions.

   If the tool returns an error listing invalid attorney links, you MUST run additional web_search_preview queries to find replacements and call generate_incident_summary again. Do not repeat rejected entries.

3. THEN, and ONLY after that tool call succeeds, reply in chat with ONE short paragraph (2–4 sentences max) that:
   - Confirms the downloadable incident summary is ready above.
   - Reminds the user that the attorney list and links are already included in the downloadable summary.
   - Adds the standard note that these are a starting point for their own research — verify credentials, bar standing, reviews, and fit before hiring; not a professional referral.
   Your chat reply MUST NOT contain any attorney names, firm names, bullet lists, URLs, or repeated summary content. Those live only inside the incident summary rendered above. Never repeat yourself or restate the summary.

GUARDRAILS
- No legal advice, no outcome predictions, no fee quotes.
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
                execute: async (input) => {
                  const attorneys = input.suggestedAttorneys ?? [];
                  const suspiciousUrl = (url: string) =>
                    /\/(?:123456|654321|111111|000000)(?:\.|\/|$)/i.test(url) ||
                    /\/profile\/[A-Z][a-z]+-[A-Z][a-z]+\/?$/.test(url) ||
                    /\{[^}]+\}/.test(url);

                  const checks = await Promise.all(
                    attorneys.map(async (a) => {
                      const issues: string[] = [];
                      let finalUrl = a.link;
                      try {
                        if (!/^https?:\/\//i.test(a.link)) {
                          issues.push("link is not a valid http(s) URL");
                        } else if (suspiciousUrl(a.link)) {
                          issues.push(
                            "link looks fabricated (placeholder ID or pattern-based path)",
                          );
                        } else {
                          const controller = new AbortController();
                          const timer = setTimeout(() => controller.abort(), 8000);
                          try {
                            const res = await fetch(a.link, {
                              redirect: "follow",
                              signal: controller.signal,
                              headers: {
                                "User-Agent":
                                  "Mozilla/5.0 (compatible; AllyAI-LinkCheck/1.0)",
                              },
                            });
                            finalUrl = res.url;
                            if (!res.ok) {
                              issues.push(`link returned HTTP ${res.status}`);
                            } else {
                              const body = (await res.text()).toLowerCase();
                              const lastName = a.name
                                .trim()
                                .split(/\s+/)
                                .pop()
                                ?.toLowerCase();
                              if (
                                lastName &&
                                lastName.length > 2 &&
                                !body.includes(lastName)
                              ) {
                                issues.push(
                                  `page at final URL ${finalUrl} does not mention "${a.name}"`,
                                );
                              }
                            }
                          } finally {
                            clearTimeout(timer);
                          }
                        }
                      } catch (err) {
                        issues.push(
                          `link failed to load: ${err instanceof Error ? err.message : String(err)}`,
                        );
                      }
                      return { attorney: a, finalUrl, issues };
                    }),
                  );

                  const invalid = checks.filter((c) => c.issues.length > 0);
                  if (invalid.length > 0) {
                    return {
                      ok: false,
                      error:
                        "One or more attorney links could not be verified. Run additional web_search_preview queries, replace the flagged entries with real attorneys whose links you actually observed in search results, and call generate_incident_summary again. Do not resubmit the flagged entries.",
                      invalid: invalid.map((c) => ({
                        name: c.attorney.name,
                        firm: c.attorney.firm,
                        link: c.attorney.link,
                        reasons: c.issues,
                      })),
                    };
                  }
                  return { ok: true, ...input };
                },
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
