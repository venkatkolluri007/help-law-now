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

type SuggestedAttorney = {
  name: string;
  firm: string;
  location: string;
  source: string;
  link: string;
};

type IncidentSummaryInput = {
  title: string;
  situationSummary: string;
  dateTimeframe: string;
  location: string;
  partiesInvolved: string;
  injuriesDamages: string;
  evidenceAvailable: string;
  desiredOutcome: string;
  urgencyDeadline: string;
  budget: string;
  areaOfLaw: string;
  suggestedAttorneys: SuggestedAttorney[];
};

type AttorneyCheck = {
  attorney: SuggestedAttorney;
  finalUrl: string;
  issues: string[];
  warnings: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const hasFailedSummaryResult = (
  steps: ReadonlyArray<{
    readonly toolResults: ReadonlyArray<{ readonly toolName: string; readonly output: unknown }>;
  }>,
) =>
  steps.some((step) =>
    step.toolResults.some(
      (result) =>
        result.toolName === "generate_incident_summary" &&
        isRecord(result.output) &&
        result.output.ok === false,
    ),
  );

const hasSuccessfulSummaryResult = (
  steps: ReadonlyArray<{
    readonly toolResults: ReadonlyArray<{ readonly toolName: string; readonly output: unknown }>;
  }>,
) =>
  steps.some((step) =>
    step.toolResults.some(
      (result) =>
        result.toolName === "generate_incident_summary" &&
        isRecord(result.output) &&
        result.output.ok === true,
    ),
  );

const getLastName = (name: string) => name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";

const suspiciousUrl = (url: string) =>
  /\/(?:123456|654321|111111|000000)(?:\.|\/|$)/i.test(url) ||
  /\/profile\/[A-Z][a-z]+-[A-Z][a-z]+\/?$/.test(url) ||
  /\{[^}]+\}/.test(url);

async function verifyAttorneyLink(attorney: SuggestedAttorney): Promise<AttorneyCheck> {
  const issues: string[] = [];
  const warnings: string[] = [];
  let finalUrl = attorney.link;
  const lastName = getLastName(attorney.name);

  if (!/^https?:\/\//i.test(attorney.link)) {
    issues.push("link is not a valid http(s) URL");
    return { attorney, finalUrl, issues, warnings };
  }

  if (suspiciousUrl(attorney.link)) {
    issues.push("link looks fabricated (placeholder ID or pattern-based path)");
    return { attorney, finalUrl, issues, warnings };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(attorney.link, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AllyAI-LinkCheck/1.0)",
      },
    });
    finalUrl = res.url;

    if (!res.ok) {
      if ([401, 403, 429].includes(res.status) && lastName && finalUrl.toLowerCase().includes(lastName)) {
        warnings.push(`link returned HTTP ${res.status}, but final URL includes attorney last name`);
        return { attorney: { ...attorney, link: finalUrl }, finalUrl, issues, warnings };
      }
      issues.push(`link returned HTTP ${res.status}`);
      return { attorney, finalUrl, issues, warnings };
    }

    const body = (await res.text()).slice(0, 250_000).toLowerCase();
    const finalUrlLower = finalUrl.toLowerCase();
    if (lastName && lastName.length > 2 && !body.includes(lastName)) {
      if (finalUrlLower.includes(lastName)) {
        warnings.push("page text did not expose the attorney name, but final URL includes the last name");
      } else {
        issues.push(`page at final URL ${finalUrl} does not mention "${attorney.name}"`);
      }
    }

    return { attorney: { ...attorney, link: finalUrl }, finalUrl, issues, warnings };
  } catch (err) {
    if (lastName && finalUrl.toLowerCase().includes(lastName)) {
      warnings.push(
        `link check was inconclusive (${err instanceof Error ? err.message : String(err)}), but URL includes attorney last name`,
      );
      return { attorney, finalUrl, issues, warnings };
    }
    issues.push(`link failed to load: ${err instanceof Error ? err.message : String(err)}`);
    return { attorney, finalUrl, issues, warnings };
  } finally {
    clearTimeout(timer);
  }
}

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

2. THEN you MUST call the \`generate_incident_summary\` tool with a fully-populated structured object using the fields defined by the tool schema, including the 2–4 suggested attorneys pulled from your live search results (each with a real link you observed). This step is mandatory — do NOT recommend attorneys in chat text without first calling this tool. Use only facts the user gave you. Neutral, factual tone. No legal conclusions.

   If the tool returns ok:false or an error listing invalid attorney links, you MUST run additional web_search_preview queries to find replacement named attorneys and call generate_incident_summary again. Do not repeat rejected entries. Retry with new live search results up to 3 times. If you still cannot find verifiable named attorneys after retries, call generate_incident_summary with suggestedAttorneys: [] so the downloadable incident summary still renders without fabricated lawyer data.

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
                execute: async (input: IncidentSummaryInput) => {
                  const attorneys = input.suggestedAttorneys ?? [];
                  console.info(
                    `[api/chat] incident summary verification started: ${input.areaOfLaw} / ${input.location}; attorneys=${attorneys.length}`,
                  );

                  const checks = await Promise.all(attorneys.map(verifyAttorneyLink));

                  const invalid = checks.filter((c) => c.issues.length > 0);
                  const verified = checks.filter((c) => c.issues.length === 0).map((c) => c.attorney);
                  const warnings = checks.flatMap((c) =>
                    c.warnings.map((warning) => `${c.attorney.name}: ${warning}`),
                  );

                  if (invalid.length > 0 && verified.length < 2) {
                    console.warn(
                      "[api/chat] incident summary verification rejected; model must re-search",
                      JSON.stringify({
                        location: input.location,
                        areaOfLaw: input.areaOfLaw,
                        verifiedCount: verified.length,
                        invalid: invalid.map((c) => ({
                          name: c.attorney.name,
                          firm: c.attorney.firm,
                          link: c.attorney.link,
                          finalUrl: c.finalUrl,
                          reasons: c.issues,
                        })),
                      }),
                    );
                    return {
                      ok: false,
                      error:
                        "Attorney links could not be verified. Run additional web_search_preview queries now, replace the flagged entries with real named attorneys whose links you actually observed in search results, and call generate_incident_summary again. Do not repeat rejected entries. If no verifiable attorneys can be found after retries, call generate_incident_summary with suggestedAttorneys: [] so the summary can still be downloaded without fabricated lawyer data.",
                      attemptedSummary: {
                        ...input,
                        suggestedAttorneys: verified,
                        verificationStatus: "verification_failed_retry_required",
                        verificationWarnings: invalid.map(
                          (c) =>
                            `${c.attorney.name} — ${c.attorney.firm}: ${c.issues.join("; ")}`,
                        ),
                      },
                      verifiedAttorneys: verified,
                      invalid: invalid.map((c) => ({
                        name: c.attorney.name,
                        firm: c.attorney.firm,
                        link: c.attorney.link,
                        finalUrl: c.finalUrl,
                        reasons: c.issues,
                      })),
                    };
                  }

                  if (invalid.length > 0) {
                    console.warn(
                      "[api/chat] incident summary accepted after filtering invalid attorney links",
                      JSON.stringify({
                        location: input.location,
                        areaOfLaw: input.areaOfLaw,
                        verifiedCount: verified.length,
                        filteredCount: invalid.length,
                      }),
                    );
                  } else {
                    console.info(
                      `[api/chat] incident summary verification passed: verified=${verified.length}`,
                    );
                  }

                  return {
                    ok: true,
                    ...input,
                    suggestedAttorneys: verified,
                    verificationStatus:
                      attorneys.length === 0
                        ? "no_attorneys_found"
                        : invalid.length > 0
                          ? "filtered_invalid_attorneys"
                          : "verified",
                    verificationWarnings: warnings,
                  };
                },
              }),
            },
            stopWhen: stepCountIs(50),
            prepareStep: ({ steps }) => {
              const lastStep = steps.at(-1);
              const previousFailedSummary = hasFailedSummaryResult(steps);
              const previousSuccessfulSummary = hasSuccessfulSummaryResult(steps);

              if (previousFailedSummary && !previousSuccessfulSummary) {
                const lastHadRejectedSummary = lastStep?.toolResults.some(
                  (result) =>
                    result.toolName === "generate_incident_summary" &&
                    isRecord(result.output) &&
                    result.output.ok === false,
                );

                if (lastHadRejectedSummary) {
                  console.info(
                    "[api/chat] forcing web_search_preview after rejected summary verification",
                  );
                  return {
                    activeTools: ["web_search_preview"],
                    toolChoice: { type: "tool", toolName: "web_search_preview" },
                  };
                }

                const lastHadRetrySearch = lastStep?.toolResults.some(
                  (result) => result.toolName === "web_search_preview",
                );

                if (lastHadRetrySearch) {
                  console.info(
                    "[api/chat] forcing generate_incident_summary after retry search",
                  );
                  return {
                    activeTools: ["generate_incident_summary"],
                    toolChoice: { type: "tool", toolName: "generate_incident_summary" },
                  };
                }
              }

              return undefined;
            },
            onStepEnd: ({ stepNumber, text, toolCalls, toolResults, finishReason }) => {
              console.info(
                "[api/chat] step complete",
                JSON.stringify({
                  stepNumber,
                  finishReason,
                  textLength: text.length,
                  toolCalls: toolCalls.map((call) => call.toolName),
                  toolResults: toolResults.map((result) => ({
                    toolName: result.toolName,
                    output:
                      result.toolName === "generate_incident_summary"
                        ? result.output
                        : "[web_search_preview output omitted]",
                  })),
                }),
              );
            },
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
