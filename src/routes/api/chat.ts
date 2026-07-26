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

type AttorneySearchContext = {
  location: string;
  areaOfLaw: string;
  budget: string;
};

type AttorneySuggestionInput = AttorneySearchContext & {
  suggestedAttorneys: SuggestedAttorney[];
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
};


type AttorneyCheck = {
  attorney: SuggestedAttorney;
  finalUrl: string;
  issues: string[];
  warnings: string[];
  status?: number;
  bodySnippet?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const stepHasTool = (
  step: {
    readonly toolResults?: ReadonlyArray<{ readonly toolName?: string }>;
    readonly toolCalls?: ReadonlyArray<{ readonly toolName?: string }>;
  } | undefined,
  toolName: string,
) =>
  !!step &&
  ((step.toolResults?.some((result) => result.toolName === toolName) ?? false) ||
    (step.toolCalls?.some((call) => call.toolName === toolName) ?? false));

const hasFailedSummaryResult = (
  steps: ReadonlyArray<{
    readonly toolResults: ReadonlyArray<{ readonly toolName: string; readonly output: unknown }>;
  }>,
) =>
  steps.some((step) =>
    step.toolResults.some(
      (result) =>
        result.toolName === "suggest_attorneys" &&
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
        result.toolName === "suggest_attorneys" &&
        isRecord(result.output) &&
        result.output.ok === true,
    ),
  );

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const getNameParts = (name: string) =>
  normalizeSearchText(name)
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((part) => part && !/^(jr|sr|ii|iii|iv|esq|attorney|lawyer)$/.test(part));

const getLastName = (name: string) => getNameParts(name).at(-1) ?? "";

const hasFullPersonName = (name: string) => getNameParts(name).length >= 2;

const PLACEHOLDER_NAMES = new Set([
  "john doe",
  "jane doe",
  "john smith",
  "jane smith",
  "emily johnson",
  "michael brown",
]);

const placeholderCandidate = (attorney: SuggestedAttorney) => {
  const fullName = getNameParts(attorney.name).join(" ");
  const firm = normalizeSearchText(attorney.firm);

  return (
    PLACEHOLDER_NAMES.has(fullName) ||
    /\bdoe\s+(and|&)\s+associates\b/.test(firm) ||
    /\bsmith\s+(law|&|and|associates|office|firm)\b/.test(firm) ||
    /\bjohnson\s+law\s+firm\b/.test(firm) ||
    /\bbrown\s+(&|and)\s+partners\b/.test(firm)
  );
};

const suspiciousUrl = (url: string) =>
  /(?:123456|654321|456729|111111|000000)(?:\.|\/|$)/i.test(url) ||
  /\/profile\/[A-Z][a-z]+-[A-Z][a-z]+\/?$/i.test(url) ||
  /\{[^}]+\}/.test(url);

const bodySnippet = (body: string) => body.replace(/\s+/g, " ").trim().slice(0, 700);

const stateAbbreviations: Record<string, string> = {
  california: "ca",
  massachusetts: "ma",
  florida: "fl",
  texas: "tx",
  colorado: "co",
  washington: "wa",
  illinois: "il",
  newyork: "ny",
};

const pageMentionsLocation = (body: string, location: string) => {
  const normalizedBody = normalizeSearchText(body);
  const parts = location
    .split(/[,/]/)
    .map((part) => normalizeSearchText(part).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const city = parts[0] ?? "";
  const state = parts.at(-1) ?? "";
  const compactState = state.replace(/\s+/g, "");
  const abbr = state.length === 2 ? state : stateAbbreviations[compactState];

  return (
    (city.length > 2 && normalizedBody.includes(city)) ||
    (state.length > 2 && normalizedBody.includes(state)) ||
    (!!abbr && new RegExp(`\\b${abbr}\\b`, "i").test(normalizedBody))
  );
};

const normalizeObservedUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${pathname || "/"}`.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
};

const collectUrlsFromUnknown = (value: unknown, urls = new Set<string>()) => {
  if (typeof value === "string") {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>\])}]+/g)) {
      urls.add(match[0].replace(/[.,;:]+$/, ""));
    }
    return urls;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectUrlsFromUnknown(item, urls));
    return urls;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((item) => collectUrlsFromUnknown(item, urls));
  }

  return urls;
};

const wasObservedInSearch = (url: string, observedSearchUrls: ReadonlySet<string>) => {
  const normalized = normalizeObservedUrl(url);
  return observedSearchUrls.has(normalized);
};

const urlContainsLastName = (url: string, lastName: string) => {
  if (!lastName || lastName.length <= 2) return false;
  try {
    const parsed = new URL(url);
    return normalizeSearchText(decodeURIComponent(`${parsed.hostname}${parsed.pathname}`)).includes(
      lastName,
    );
  } catch {
    return normalizeSearchText(url).includes(lastName);
  }
};

const looksLikeBotWall = (status: number, body: string) => {
  if (status !== 403 && status !== 429) return false;
  const snippet = normalizeSearchText(bodySnippet(body));
  return (
    body.trim().length === 0 ||
    snippet.length < 300 ||
    /\b(access denied|forbidden|too many requests|rate limit|captcha|robot|bot|cloudflare|verify you are human|request blocked)\b/.test(
      snippet,
    )
  );
};

const pageMentionsAttorney = (body: string, attorney: SuggestedAttorney) => {
  const normalizedBody = normalizeSearchText(body);
  const parts = getNameParts(attorney.name);
  const firstName = parts[0] ?? "";
  const lastName = parts.at(-1) ?? "";

  if (!firstName || firstName.length <= 2 || !lastName || lastName.length <= 2) return false;

  const compactBody = normalizedBody.replace(/[^a-z]+/g, " ").replace(/\s+/g, " ").trim();
  const firstLastPattern = new RegExp(`\\b${firstName}\\b(?:\\s+[a-z]\\.?){0,3}\\s+\\b${lastName}\\b`);
  return firstLastPattern.test(compactBody);
};

const DIRECTORY_HOSTS = [
  "avvo.com",
  "superlawyers.com",
  "martindale.com",
  "findlaw.com",
  "justia.com",
];

const isDirectoryUrl = (url: string) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return DIRECTORY_HOSTS.some((directoryHost) => host.endsWith(directoryHost));
  } catch {
    return false;
  }
};

const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();

const cleanCandidateName = (name: string) =>
  name
    .replace(/\b(Esq\.?|Attorney|Lawyer|Partner|Associate|Founder|Owner|Offices?|Law|Group|P\.?C\.?|A\.?P\.?C\.?)\b/gi, " ")
    .replace(/[^A-Za-z.'\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isLikelyPersonName = (name: string) => {
  const cleaned = cleanCandidateName(name);
  const parts = getNameParts(cleaned);
  const normalized = parts.join(" ");
  const badWords = new Set([
    "law",
    "legal",
    "firm",
    "group",
    "office",
    "attorney",
    "lawyer",
    "personal",
    "injury",
    "employment",
    "accident",
    "retaliation",
    "wrongful",
    "termination",
    "california",
    "massachusetts",
    "angeles",
    "boston",
  ]);

  if (parts.length < 2 || parts.length > 4 || PLACEHOLDER_NAMES.has(normalized)) return false;
  if (parts.some((part) => badWords.has(part))) return false;
  return /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(cleaned);
};

const normalizeAttorneyCandidate = (attorney: SuggestedAttorney): SuggestedAttorney => {
  const cleanedName = cleanCandidateName(attorney.name);
  return { ...attorney, name: cleanedName || attorney.name.trim() };
};

const extractTagText = (html: string, tagName: string) => {
  const matches = [...html.matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi"))];
  return matches.map((match) => stripHtml(match[1] ?? "")).filter(Boolean);
};

const extractMetaContent = (html: string, property: string) => {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return (match?.[1] ?? match?.[2] ?? "").trim();
};

const collectJsonLdNames = (value: unknown, names: Set<string>) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdNames(item, names));
    return;
  }
  if (!isRecord(value)) return;

  const rawType = value["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  const isPerson = types.some(
    (type) => typeof type === "string" && /^(person|attorney)$/i.test(type),
  );
  const rawName = value.name;
  if (isPerson && typeof rawName === "string" && isLikelyPersonName(rawName)) {
    names.add(cleanCandidateName(rawName));
  }

  Object.values(value).forEach((item) => collectJsonLdNames(item, names));
};

const extractPersonNames = (html: string) => {
  const names = new Set<string>();

  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      collectJsonLdNames(JSON.parse(match[1] ?? ""), names);
    } catch {
      // Ignore malformed structured data; visible page text is checked below.
    }
  }

  const visibleText = stripHtml(html).slice(0, 80_000);
  const titleTexts = [
    ...extractTagText(html, "title"),
    ...extractTagText(html, "h1"),
    ...extractTagText(html, "h2"),
    extractMetaContent(html, "og:title"),
    visibleText,
  ].filter(Boolean);

  titleTexts.forEach((text) => {
    const segments = text.split(/\s+[|–—-]\s+|:\s+/).map((segment) => segment.trim());
    segments.forEach((segment) => {
      const patterns = [
        /(?:law offices? of|attorneys?|lawyers?|our attorneys?|meet(?:\s+our)?(?:\s+attorneys?|\s+team)?|founder)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/g,
        /^([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\b/g,
      ];
      patterns.forEach((pattern) => {
        for (const match of segment.matchAll(pattern)) {
          const candidate = cleanCandidateName(match[1] ?? "");
          if (isLikelyPersonName(candidate)) names.add(candidate);
        }
      });
    });
  });

  return [...names];
};

const extractFirmName = (html: string, url: string) => {
  const siteName = extractMetaContent(html, "og:site_name");
  if (siteName) return stripHtml(siteName).slice(0, 90);

  const title = extractTagText(html, "title")[0];
  if (title) return title.split(/\s+[|–—-]\s+/)[0]?.trim().slice(0, 90) || title.slice(0, 90);

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Verified firm website";
  }
};

const collectTextFromUnknown = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectTextFromUnknown).join("\n");
  if (!isRecord(value)) return "";
  return Object.entries(value)
    .filter(([key]) => key !== "annotations")
    .map(([, item]) => collectTextFromUnknown(item))
    .join("\n");
};

const parseAttorneyJson = (text: string): SuggestedAttorney[] => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const jsonMatch = source.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const rawAttorneys = isRecord(parsed) && Array.isArray(parsed.attorneys) ? parsed.attorneys : [];
    return rawAttorneys
      .filter(isRecord)
      .map((item) => ({
        name: typeof item.name === "string" ? item.name.trim() : "",
        firm: typeof item.firm === "string" ? item.firm.trim() : "",
        location: typeof item.location === "string" ? item.location.trim() : "",
        source: typeof item.source === "string" ? item.source.trim() : "Live web search",
        link: typeof item.link === "string" ? item.link.trim() : "",
      }))
      .filter((attorney) => attorney.name && attorney.firm && /^https?:\/\//i.test(attorney.link));
  } catch (error) {
    console.warn(
      "[api/chat] fallback attorney JSON parse failed",
      JSON.stringify({ error: error instanceof Error ? error.message : String(error), text: text.slice(0, 1200) }),
    );
    return [];
  }
};

const searchAttorneyCandidates = async (input: AttorneySearchContext, apiKey: string) => {
  const prompt = `Find 3 to 5 real individual attorneys for this legal intake handoff.

Location: ${input.location}
Practice area: ${input.areaOfLaw}
Budget/preferences: ${input.budget}

Use live web search. Prefer official law-firm attorney bio, team, profile, or about pages that clearly name the individual attorney. Avoid Avvo, Justia, Martindale, FindLaw, Super Lawyers, or other directory URLs unless you cannot find an official firm page. Do not guess URLs. Do not use placeholder names like John Doe/Jane Smith.

Return ONLY valid JSON in this exact shape, with exact URLs you found:
{"attorneys":[{"name":"Full Name","firm":"Firm Name","location":"City, ST","source":"Official firm website","link":"https://..."}]}`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        input: prompt,
        tools: [{ type: "web_search_preview" }],
        tool_choice: "auto",
      }),
    });

    const body = await res.text();
    console.info(
      "[api/chat] fallback OpenAI attorney search response",
      JSON.stringify({ status: res.status, ok: res.ok, bodySnippet: bodySnippet(body) }),
    );
    if (!res.ok) return [];

    const parsed: unknown = JSON.parse(body);
    return parseAttorneyJson(collectTextFromUnknown(parsed));
  } catch (error) {
    console.warn(
      "[api/chat] fallback OpenAI attorney search failed",
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
    );
    return [];
  }
};

const fetchHtmlPage = async (url: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const contentType = res.headers.get("content-type") ?? "";
    const html = await res.text();
    return { ok: res.ok && /html/i.test(contentType), status: res.status, url: res.url, html };
  } catch (error) {
    return { ok: false, status: 0, url, html: String(error) };
  } finally {
    clearTimeout(timer);
  }
};

const extractInternalProfileLinks = (html: string, baseUrl: string) => {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1] ?? "";
    const label = stripHtml(match[2] ?? "");
    try {
      const url = new URL(href, baseUrl);
      const base = new URL(baseUrl);
      if (url.hostname !== base.hostname) continue;
      const haystack = normalizeSearchText(`${url.pathname} ${label}`);
      if (!/(attorney|attorneys|lawyer|lawyers|team|people|professional|professionals|profile|bio|about|firm)/.test(haystack)) {
        continue;
      }
      links.push(url.toString());
    } catch {
      // Skip malformed links.
    }
  }
  return [...new Set(links)].slice(0, 8);
};

const discoverVerifiedAttorneys = async (
  input: AttorneySearchContext,
  observedSearchUrlMap: ReadonlyMap<string, string>,
  alreadyVerified: ReadonlyArray<SuggestedAttorney>,
  apiKey: string,
) => {
  const discovered: SuggestedAttorney[] = [];
  const seenNames = new Set(alreadyVerified.map((attorney) => normalizeSearchText(attorney.name)));
  const observedUrls = [...observedSearchUrlMap.values()]
    .filter((url) => /^https?:\/\//i.test(url))
    .sort((a, b) => Number(isDirectoryUrl(a)) - Number(isDirectoryUrl(b)))
    .slice(0, 14);

  for (const sourceUrl of observedUrls) {
    if (discovered.length >= 2) break;
    const firstPage = await fetchHtmlPage(sourceUrl);
    console.info(
      "[api/chat] discovery source fetch",
      JSON.stringify({
        sourceUrl,
        finalUrl: firstPage.url,
        status: firstPage.status,
        ok: firstPage.ok,
        bodySnippet: bodySnippet(firstPage.html),
      }),
    );
    if (!firstPage.ok) continue;

    const profileUrls = [firstPage.url, ...extractInternalProfileLinks(firstPage.html, firstPage.url)].slice(
      0,
      9,
    );

    for (const profileUrl of profileUrls) {
      if (discovered.length >= 2) break;
      const page = profileUrl === firstPage.url ? firstPage : await fetchHtmlPage(profileUrl);
      if (!page.ok) continue;

      const firm = extractFirmName(page.html, page.url);
      const names = extractPersonNames(page.html);
      for (const name of names) {
        if (discovered.length >= 2) break;
        const normalizedName = normalizeSearchText(name);
        if (seenNames.has(normalizedName)) continue;

        const candidate: SuggestedAttorney = {
          name,
          firm,
          location: input.location,
          source: "Verified firm website from live search",
          link: page.url,
        };
        const check = await verifyAttorneyLink(candidate, new Set([normalizeObservedUrl(page.url)]));
        if (check.issues.length > 0) continue;

        seenNames.add(normalizedName);
        discovered.push(check.attorney);
        console.info(
          "[api/chat] discovery verified attorney",
          JSON.stringify({ name: check.attorney.name, firm: check.attorney.firm, link: check.attorney.link }),
        );
      }
    }
  }

  if (discovered.length < 2) {
    const searchedCandidates = await searchAttorneyCandidates(input, apiKey);
    console.info(
      "[api/chat] fallback attorney search candidates",
      JSON.stringify({ count: searchedCandidates.length, candidates: searchedCandidates }),
    );

    for (const candidate of searchedCandidates) {
      if (discovered.length >= 2) break;
      const normalizedName = normalizeSearchText(candidate.name);
      if (seenNames.has(normalizedName)) continue;

      const check = await verifyAttorneyLink(
        { ...candidate, location: input.location },
        new Set(),
      );
      if (check.issues.length > 0) {
        console.warn(
          "[api/chat] fallback attorney candidate rejected",
          JSON.stringify({ candidate, reasons: check.issues, finalUrl: check.finalUrl, status: check.status }),
        );
        continue;
      }

      seenNames.add(normalizedName);
      discovered.push(check.attorney);
      console.info(
        "[api/chat] fallback attorney candidate verified",
        JSON.stringify({ name: check.attorney.name, firm: check.attorney.firm, link: check.attorney.link }),
      );
    }
  }

  return discovered;
};

async function verifyAttorneyLink(
  attorney: SuggestedAttorney,
  observedSearchUrls: ReadonlySet<string>,
): Promise<AttorneyCheck> {
  attorney = normalizeAttorneyCandidate(attorney);
  const issues: string[] = [];
  const warnings: string[] = [];
  let finalUrl = attorney.link;
  const lastName = getLastName(attorney.name);

  if (!/^https?:\/\//i.test(attorney.link)) {
    issues.push("link is not a valid http(s) URL");
    console.warn("[api/chat] attorney candidate preflight failed", JSON.stringify({
      name: attorney.name,
      firm: attorney.firm,
      link: attorney.link,
      issues,
    }));
    return { attorney, finalUrl, issues, warnings };
  }

  if (placeholderCandidate(attorney)) {
    issues.push("candidate uses a generic placeholder attorney name or firm pattern");
    console.warn("[api/chat] attorney candidate preflight failed", JSON.stringify({
      name: attorney.name,
      firm: attorney.firm,
      link: attorney.link,
      issues,
    }));
    return { attorney, finalUrl, issues, warnings };
  }

  if (!hasFullPersonName(attorney.name)) {
    issues.push("candidate does not name a specific individual attorney with first and last name");
    console.warn("[api/chat] attorney candidate preflight failed", JSON.stringify({
      name: attorney.name,
      firm: attorney.firm,
      link: attorney.link,
      issues,
    }));
    return { attorney, finalUrl, issues, warnings };
  }

  if (suspiciousUrl(attorney.link)) {
    issues.push("link looks fabricated (placeholder ID or pattern-based path)");
    console.warn("[api/chat] attorney candidate preflight failed", JSON.stringify({
      name: attorney.name,
      firm: attorney.firm,
      link: attorney.link,
      issues,
    }));
    return { attorney, finalUrl, issues, warnings };
  }

  if (observedSearchUrls.size > 0 && !wasObservedInSearch(attorney.link, observedSearchUrls)) {
    warnings.push("link was not visible in captured web_search_preview URLs; requiring page-content verification");
    console.warn("[api/chat] attorney candidate preflight failed", JSON.stringify({
      name: attorney.name,
      firm: attorney.firm,
      link: attorney.link,
      observedSearchUrlCount: observedSearchUrls.size,
      warnings,
    }));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(attorney.link, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Use a real browser UA — Avvo, Martindale, Super Lawyers, Justia,
        // and most legal directories block generic bot UAs with 403/429,
        // which would otherwise cause every real attorney link to fail.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    finalUrl = res.url;
    const status = res.status;
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    const snippet = bodySnippet(body);

    console.info(
      "[api/chat] attorney candidate fetch",
      JSON.stringify({
        name: attorney.name,
        firm: attorney.firm,
        source: attorney.source,
        originalUrl: attorney.link,
        finalUrl,
        status,
        ok: res.ok,
        contentType,
        bodyLength: body.length,
        bodySnippet: snippet,
      }),
    );

    // Hard reject pages that are unambiguously gone. These are not bot walls.
    if (res.status === 404 || res.status === 410) {
      issues.push(`link returned HTTP ${res.status}`);
      return { attorney, finalUrl, issues, warnings, status, bodySnippet: snippet };
    }

    // Only tolerate genuine bot-wall/rate-limit responses. Other non-OK states,
    // including redirects to error pages, remain hard rejections.
    if (!res.ok) {
      if (
        looksLikeBotWall(res.status, body) &&
        body.trim().length === 0 &&
        urlContainsLastName(finalUrl, lastName) &&
        (observedSearchUrls.size === 0 || wasObservedInSearch(finalUrl, observedSearchUrls))
      ) {
        warnings.push(
          `link returned HTTP ${res.status} bot protection with no body; accepted only because the observed URL itself names the attorney`,
        );
        return {
          attorney: { ...attorney, link: finalUrl },
          finalUrl,
          issues,
          warnings,
          status,
          bodySnippet: snippet,
        };
      }

      issues.push(`link returned HTTP ${res.status}`);
      return { attorney, finalUrl, issues, warnings, status, bodySnippet: snippet };
    }

    const visiblePageText = stripHtml(body).slice(0, 400_000);

    if (!pageMentionsAttorney(visiblePageText, attorney)) {
      issues.push(
        `page at final URL ${finalUrl} does not mention both the attorney first name and last name`,
      );
      return { attorney, finalUrl, issues, warnings, status, bodySnippet: snippet };
    }

    const pageTitle = extractTagText(body, "title")[0] ?? "";
    const finalPath = new URL(finalUrl).pathname.replace(/\/+$/, "");
    if (
      (!finalPath || finalPath === "") &&
      !pageMentionsAttorney(pageTitle, attorney) &&
      !urlContainsLastName(finalUrl, getLastName(attorney.name))
    ) {
      issues.push(
        `homepage URL ${finalUrl} does not name the attorney in the title or URL; rejecting generic firm homepage`,
      );
      return { attorney, finalUrl, issues, warnings, status, bodySnippet: snippet };
    }

    if (attorney.location && !pageMentionsLocation(visiblePageText, attorney.location)) {
      issues.push(`page at final URL ${finalUrl} does not mention the requested location "${attorney.location}"`);
      return { attorney, finalUrl, issues, warnings, status, bodySnippet: snippet };
    }

    return {
      attorney: { ...attorney, link: finalUrl },
      finalUrl,
      issues,
      warnings,
      status,
      bodySnippet: snippet,
    };
  } catch (err) {
    issues.push(`link check failed: ${err instanceof Error ? err.message : String(err)}`);
    console.warn(
      "[api/chat] attorney candidate fetch failed",
      JSON.stringify({
        name: attorney.name,
        firm: attorney.firm,
        source: attorney.source,
        originalUrl: attorney.link,
        finalUrl,
        issues,
      }),
    );
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

WHEN YOU HAVE ENOUGH DETAIL — follow these steps in this exact order. Do NOT skip any step.
1. FIRST use the web_search_preview tool to find real attorneys matching location + specialty + budget. Prefer accessible firm websites and official attorney bio/team pages first, then Justia, state bar directories, FindLaw, Super Lawyers, Avvo, and Martindale-Hubbell. You MUST name specific individual attorneys. If a search returns only practice-area landing pages or firm homepages, run follow-up searches for that firm's attorney/team/bio pages and use only URLs that appear directly in the search results. Run multiple searches if needed until you have 2–4 real named attorneys with URLs you actually observed in tool output.

   ABSOLUTE ANTI-FABRICATION RULES — non-negotiable:
   - Every attorney name, firm name, and URL you emit MUST come verbatim from a web_search_preview result you actually received in this conversation. If you did not see it in a tool result, you do not have it.
   - NEVER invent, guess, extrapolate, or "construct" a URL. No placeholder or pattern-based IDs (e.g. /123456, /654321, /profile/First-Last, /attorneys/{zip}-{state}-{name}-{id}.html). If you find yourself typing a URL you didn't literally copy from a search result, stop.
   - Directory pages that return 404/410, generic error pages, or unrelated redirects are NOT working links. Replace them with accessible firm bio pages or call suggest_attorneys with an empty suggestedAttorneys array.
   - NEVER pair a real firm with a made-up attorney name, or a real attorney with a guessed profile URL. Only emit an attorney if BOTH the name and a link to that specific attorney (or their firm's team/bio page naming them) appeared in your search results.
   - Generic placeholder names and firms are strictly forbidden: John Doe, Jane Doe, John Smith, Jane Smith, Emily Johnson, Michael Brown, Doe and Associates, Smith Law Office, Smith & Associates, Johnson Law Firm, Brown & Partners, and similar generic examples must be discarded and re-searched.
   - Backend verification rejects any URL that did not appear directly in web_search_preview results for this conversation, rejects 404/410/dead/error pages, and requires the fetched page text to mention the attorney's first and last name. Prefer official firm bio pages because directory pages often block verification.
   - If after multiple searches you cannot find 2 real named attorneys with verifiable URLs, call suggest_attorneys with an empty suggestedAttorneys array rather than fabricating entries.

2. THEN you MUST call the \`suggest_attorneys\` tool with location, areaOfLaw, budget, and the 2–4 attorneys pulled from your live search results (each with a real link you observed). The verified results are rendered to the user as their own clickable list — do NOT write attorney names or URLs in chat text yourself.

   If the tool returns ok:false or an error listing invalid attorney links, you MUST run additional web_search_preview queries to find replacement named attorneys and call suggest_attorneys again. Do not repeat rejected entries. Search for exact official firm bio/team pages for the specialty and city, not generic directory guesses or firm homepages. Retry with new live search results up to 3 times. If you still cannot find verifiable named attorneys after retries, call suggest_attorneys with suggestedAttorneys: [] and continue.

3. THEN you MUST call the \`generate_incident_summary\` tool with a fully-populated structured object using the fields defined by the tool schema. This document contains ONLY the user's situation details — it must never include attorney names, firms, or links. Use only facts the user gave you. Neutral, factual tone. No legal conclusions.

4. THEN, and ONLY after both tool calls succeed, reply in chat with ONE short paragraph (2–4 sentences max) that:
   - Confirms the downloadable incident summary is ready above and contains only their situation details.
   - Notes that any verified attorney links are listed separately above, or plainly says none could be verified this time.
   - Adds the standard note that these are a starting point for their own research — verify credentials, bar standing, reviews, and fit before hiring; not a professional referral.
   Your chat reply MUST NOT contain any attorney names, firm names, bullet lists, URLs, or repeated summary content. Never repeat yourself or restate the summary.


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
          const observedSearchUrls = new Set<string>();
          const observedSearchUrlMap = new Map<string, string>();
          const result = streamText({
            model: openai.responses("gpt-4o"),
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages as UIMessage[]),
            tools: {
              web_search_preview: openai.tools.webSearchPreview({}),
              suggest_attorneys: tool({
                description:
                  "Submit the real attorneys found via live web search for server-side verification. Call this once, after the intake is complete and web_search_preview has been run, and before generate_incident_summary. Verified results are rendered to the user as a separate clickable list.",
                inputSchema: z.object({
                  location: z.string().describe("City, state/country the user needs an attorney in."),
                  areaOfLaw: z
                    .string()
                    .describe("Legal subfield, e.g. 'Family law', 'Employment', 'Personal injury'."),
                  budget: z.string().describe("The user's stated budget or price expectations."),
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
                execute: async (input: AttorneySuggestionInput) => {
                  const attorneys = input.suggestedAttorneys ?? [];
                  console.info(
                    `[api/chat] attorney verification started: ${input.areaOfLaw} / ${input.location}; attorneys=${attorneys.length}`,
                  );

                  const checks = await Promise.all(
                    attorneys.map((attorney) => verifyAttorneyLink(attorney, observedSearchUrls)),
                  );

                  const invalid = checks.filter((c) => c.issues.length > 0);
                  const verified = checks.filter((c) => c.issues.length === 0).map((c) => c.attorney);
                  const warnings = checks.flatMap((c) =>
                    c.warnings.map((warning) => `${c.attorney.name}: ${warning}`),
                  );

                  if (verified.length < 2) {
                    const discovered = await discoverVerifiedAttorneys(
                      input,
                      observedSearchUrlMap,
                      verified,
                      key,
                    );
                    discovered.forEach((attorney) => verified.push(attorney));
                    if (discovered.length > 0) {
                      warnings.push(
                        `Server verified ${discovered.length} attorney(s) from live search result pages after rejecting invalid model candidates.`,
                      );
                    }
                  }

                  if (invalid.length > 0 && verified.length < 2) {
                    console.warn(
                      "[api/chat] attorney verification rejected; model must re-search",
                      JSON.stringify({
                        location: input.location,
                        areaOfLaw: input.areaOfLaw,
                        verifiedCount: verified.length,
                        observedSearchUrlCount: observedSearchUrls.size,
                        observedSearchUrls: [...observedSearchUrlMap.values()].slice(0, 20),
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
                        "Attorney links could not be verified. Run additional web_search_preview queries now, replace the flagged entries with real named attorneys whose links you actually observed in search results, and call suggest_attorneys again. Do not repeat rejected entries. If no verifiable attorneys can be found after retries, call suggest_attorneys with suggestedAttorneys: [] and continue to generate_incident_summary.",
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

                  console.info(
                    `[api/chat] attorney verification passed: verified=${verified.length}, filtered=${invalid.length}`,
                  );

                  return {
                    ok: true,
                    location: input.location,
                    areaOfLaw: input.areaOfLaw,
                    verifiedAttorneys: verified,
                    verificationStatus:
                      verified.length === 0
                        ? "no_attorneys_found"
                        : invalid.length > 0
                          ? "filtered_invalid_attorneys"
                          : "verified",
                    verificationWarnings: warnings,
                  };
                },
              }),
              generate_incident_summary: tool({
                description:
                  "Emit a finalized, structured incident-summary document the user can download and share with an attorney. Call this exactly once, after suggest_attorneys. It must contain only the user's situation details — never attorney suggestions.",
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
                }),
                execute: async (input: IncidentSummaryInput) => {
                  console.info(
                    `[api/chat] incident summary emitted: ${input.areaOfLaw} / ${input.location}`,
                  );
                  return { ok: true, ...input };
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
                    result.toolName === "suggest_attorneys" &&
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

                const lastHadRetrySearch = stepHasTool(lastStep, "web_search_preview");

                if (lastHadRetrySearch) {
                  console.info(
                    "[api/chat] forcing suggest_attorneys after retry search",
                  );
                  return {
                    activeTools: ["suggest_attorneys"],
                    toolChoice: { type: "tool", toolName: "suggest_attorneys" },
                  };
                }
              }

              return undefined;
            },
            onStepEnd: ({ stepNumber, text, toolCalls, toolResults, finishReason }) => {
              toolResults.forEach((result) => {
                if (result.toolName !== "web_search_preview") return;
                collectUrlsFromUnknown(result.output).forEach((url) => {
                  const normalized = normalizeObservedUrl(url);
                  observedSearchUrls.add(normalized);
                  if (!observedSearchUrlMap.has(normalized)) {
                    observedSearchUrlMap.set(normalized, url);
                  }
                });
              });
              console.info(
                "[api/chat] step complete",
                JSON.stringify({
                  stepNumber,
                  finishReason,
                  textLength: text.length,
                  observedSearchUrlCount: observedSearchUrls.size,
                  toolCalls: toolCalls.map((call) => call.toolName),
                  toolResults: toolResults.map((result) => ({
                    toolName: result.toolName,
                    output:
                      result.toolName !== "web_search_preview"
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
