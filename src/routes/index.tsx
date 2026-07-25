import { useChat } from "@ai-sdk/react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Clock,
  Globe,
  Lock,
  MessageCircle,
  Scale,
  ShieldCheck,
  Sparkles,
  User,
  Wand2,
  Zap,
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import logo from "@/assets/legal-guide-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { ListPracticeDialog } from "@/components/list-practice-dialog";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Ally AI — Guided legal help, just in time" },
      { name: "description", content: "Private, no-persistence chat triage that helps you understand your legal situation and finds real attorneys with live web search." },
      { property: "og:title", content: "Ally AI — Guided legal help, just in time" },
      { property: "og:description", content: "Private, no-persistence chat triage that helps you understand your legal situation and finds real attorneys with live web search." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SPECIALTIES = [
  "Family Law",
  "Employment Law",
  "Immigration",
  "Personal Injury",
  "Criminal Defense",
  "Housing",
  "Wills & Estates",
  "Contracts",
  "Intellectual Property",
];

const QUICK_PROMPTS = [
  "I'm going through a divorce and worried about custody",
  "My employer let me go unexpectedly",
  "I need help with a visa application",
  "I was injured and don't know what to do next",
];

const WELCOME_MESSAGE: UIMessage = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Hi — I'm here to help you make sense of your legal situation. I won't give legal advice, but I can ask a few questions and search the web for real attorneys who match. What brings you here today?",
    },
  ],
};

type Submission = {
  id: string;
  name: string;
  title: string;
  specialty: string;
  location: string;
  description: string;
  photoUrl: string;
};

function HomePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const chatTransport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: "ally-ai-chat",
    transport: chatTransport,
    messages: [WELCOME_MESSAGE],
  });

  const isLoading = status === "submitted" || status === "streaming";

  const composerRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef(status);

  useEffect(() => {
    composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const prev = previousStatusRef.current;
    if (status === "ready" && (prev === "streaming" || prev === "submitted")) {
      composerRef.current?.querySelector("textarea")?.focus();
    }
    previousStatusRef.current = status;
  }, [status]);

  const loadSubmissions = async () => {
    const { data, error } = await supabase
      .from("attorney_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load submissions", error);
      return;
    }
    setSubmissions(
      (data ?? []).map((row) => ({
        id: `sub-${row.id}`,
        name: row.full_name,
        title: row.title,
        specialty: row.specialty,
        location: row.location,
        description: row.description,
        photoUrl: row.photo_url,
      }))
    );
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const handlePromptSubmit = async ({
    text,
  }: {
    text: string;
    files: unknown[];
  }) => {
    if (!text.trim() || isLoading) return;
    await sendMessage({ text: text.trim() });
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Header />
      <Hero onQuickStart={() => document.getElementById("chat")?.scrollIntoView({ behavior: "smooth" })} />
      <HowItWorks />
      <ChatSection
        messages={messages}
        status={status}
        stop={stop}
        isLoading={isLoading}
        composerRef={composerRef}
        handlePromptSubmit={handlePromptSubmit}
      />
      <TrustSection />
      <DirectorySection submissions={submissions} onSubmitted={loadSubmissions} />
      <Footer />
    </div>
  );
}

/* ---------------- HERO ---------------- */

function Hero({ onQuickStart }: { onQuickStart: () => void }) {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 600], [0, -80]);
  const y2 = useTransform(scrollY, [0, 600], [0, -160]);
  const y3 = useTransform(scrollY, [0, 600], [0, 60]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0.3]);

  return (
    <section className="relative isolate overflow-hidden pt-20 pb-24 sm:pt-28 lg:pt-32 lg:pb-32">
      {/* Animated mesh background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-soft opacity-60" />
        <motion.div
          style={{ y: y2 }}
          className="mesh-orb-a absolute -top-32 -left-24 h-[36rem] w-[36rem] rounded-full opacity-60 blur-3xl"
          aria-hidden
        >
          <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_30%_30%,oklch(0.75_0.14_186/0.9),transparent_70%)]" />
        </motion.div>
        <motion.div
          style={{ y: y3 }}
          className="mesh-orb-b absolute top-40 -right-32 h-[40rem] w-[40rem] rounded-full opacity-50 blur-3xl"
          aria-hidden
        >
          <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_60%_50%,oklch(0.78_0.15_85/0.85),transparent_70%)]" />
        </motion.div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>

      <motion.div style={{ opacity }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-7"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full glass-panel px-4 py-1.5 text-sm font-medium text-primary"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Private · No chat history saved
            </motion.div>

            <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl leading-[1.02]">
              Guided legal help,
              <br />
              <span className="text-gradient-sage">just in time.</span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Describe what's happening. Ally AI triages your situation, then searches the live web across real attorney directories to surface actual lawyers you can vet yourself.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={onQuickStart}
                className="group relative inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-shadow hover:shadow-[0_20px_50px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
              >
                <Sparkles className="size-4 transition-transform group-hover:rotate-12" />
                Start a private chat
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                href="#how"
                className="inline-flex items-center gap-2 rounded-full glass-panel px-6 py-3.5 text-sm font-semibold text-foreground"
              >
                How it works
              </motion.a>
            </div>

            <div className="flex flex-wrap gap-6 pt-4 text-xs text-muted-foreground">
              <StatChip label="Live web search" value="Real time" />
              <StatChip label="Directories crawled" value="Avvo · Justia · FindLaw" />
              <StatChip label="Data retention" value="0 seconds" />
            </div>
          </motion.div>

          {/* 3D floating hero card */}
          <motion.div
            style={{ y: y1 }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative mx-auto w-full max-w-lg perspective-1200"
          >
            <TiltCard>
              <div className="relative rounded-3xl glass-panel p-6 sm:p-8">
                <div className="absolute -top-6 -right-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg float-3d">
                  <Scale className="size-8" />
                </div>
                <div className="mb-5 flex items-center gap-3">
                  <img src={logo} alt="" width={40} height={40} className="h-10 w-10" />
                  <div>
                    <div className="text-sm font-semibold">Ally AI</div>
                    <div className="text-xs text-muted-foreground">Legal triage assistant</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <FakeBubble side="user">
                    I need a family lawyer in Seattle, budget ~$2,500.
                  </FakeBubble>
                  <FakeBubble side="assistant" delay={0.4}>
                    Got it. Searching Avvo, Justia & Super Lawyers now…
                  </FakeBubble>
                  <FakeBubble side="assistant" delay={1.1}>
                    <span className="flex items-center gap-2 font-medium">
                      <Globe className="size-4 text-primary" /> 4 real matches found
                    </span>
                  </FakeBubble>
                </div>
                <div className="mt-6 rounded-2xl border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    <Lock className="size-3" /> Ephemeral
                  </span>{" "}
                  This conversation is not stored anywhere.
                </div>
              </div>
            </TiltCard>

            {/* Floating chips around card */}
            <motion.div
              className="absolute -left-8 top-24 float-3d-slow hidden md:block"
              aria-hidden
            >
              <div className="glass-panel rounded-xl px-3 py-2 text-xs font-medium shadow-lg">
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />
                Live search
              </div>
            </motion.div>
            <motion.div
              className="absolute -right-4 bottom-10 float-3d hidden md:block"
              aria-hidden
            >
              <div className="glass-panel rounded-xl px-3 py-2 text-xs font-medium shadow-lg">
                <ShieldCheck className="mr-1 inline size-3 text-primary" />
                No data stored
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function FakeBubble({ side, children, delay = 0 }: { side: "user" | "assistant"; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 + delay, duration: 0.5 }}
      className={cn(
        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
        side === "user"
          ? "ml-auto bg-primary text-primary-foreground"
          : "mr-auto bg-muted text-foreground"
      )}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Tilt card wrapper ---------------- */

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 12);
    rotateX.set(-py * 12);
  };
  const handleLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={cn("relative", className)}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- How it works ---------------- */

function HowItWorks() {
  const steps = [
    {
      icon: MessageCircle,
      title: "Describe what's happening",
      body: "Chat naturally in plain language. Ally asks a few focused questions to understand your situation without judgment.",
      accent: "from-[oklch(0.75_0.14_186)] to-[oklch(0.6_0.12_200)]",
    },
    {
      icon: Wand2,
      title: "We triage the issue",
      body: "The assistant identifies the legal subfield, urgency, and what kind of expert you actually need — no legal advice, just clarity.",
      accent: "from-[oklch(0.78_0.15_85)] to-[oklch(0.7_0.13_60)]",
    },
    {
      icon: Globe,
      title: "Live search finds real lawyers",
      body: "Ally searches the live web across Avvo, Justia, FindLaw & Super Lawyers and returns 2–4 real attorneys with working links you can verify yourself.",
      accent: "from-[oklch(0.65_0.12_220)] to-[oklch(0.55_0.11_260)]",
    },
  ];

  return (
    <section id="how" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealHeader
          eyebrow="How it works"
          title={<>Triage first. <span className="text-gradient-sage">Real lawyers second.</span></>}
          subtitle="Ally isn't a static directory of stock photos. It's a live agent that understands your situation and pulls current results from the open web."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-3 perspective-1200">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.12}>
              <TiltCard>
                <div className="group relative h-full rounded-3xl glass-panel p-7">
                  <div className={cn("mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg float-3d", s.accent)}>
                    <s.icon className="size-7" />
                  </div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Step {i + 1}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
                  <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Learn more <ArrowRight className="size-4" />
                  </div>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Chat ---------------- */

function ChatSection({
  messages,
  status,
  stop,
  isLoading,
  composerRef,
  handlePromptSubmit,
}: {
  messages: UIMessage[];
  status: ReturnType<typeof useChat>["status"];
  stop: () => void;
  isLoading: boolean;
  composerRef: React.RefObject<HTMLDivElement | null>;
  handlePromptSubmit: (v: { text: string; files: unknown[] }) => void;
}) {
  return (
    <section id="chat" className="relative py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <RevealHeader
          eyebrow="Chat"
          title={<>Talk it through. <span className="text-gradient-sage">In private.</span></>}
          subtitle="No account. No history. Nothing stored. When you close this tab, this conversation is gone."
        />

        <Reveal>
          <div className="mt-12 perspective-1200">
            <TiltCard>
              <div className="relative rounded-3xl glass-panel overflow-hidden">
                <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Scale className="size-5 text-primary" />
                    <span className="absolute inset-0 rounded-full ring-2 ring-primary/30 animate-ping" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Legal Triage Assistant</h2>
                    <p className="text-xs text-muted-foreground">
                      Ephemeral · Not legal advice · Live web search enabled
                    </p>
                  </div>
                </div>

                <Conversation className="h-[30rem]">
                  <ConversationContent>
                    {messages.length === 0 ? (
                      <ConversationEmptyState
                        icon={<MessageCircle className="size-8" />}
                        title="Start your conversation"
                        description="Tell us what's going on so we can point you in the right direction."
                      />
                    ) : (
                      messages
                        .filter((m): m is UIMessage & { role: "assistant" | "user" } =>
                          m.role === "assistant" || m.role === "user"
                        )
                        .map((message) => (
                          <ChatMessage
                            key={message.id}
                            message={message}
                            isStreaming={
                              status === "streaming" &&
                              message.id === messages[messages.length - 1]?.id
                            }
                          />
                        ))
                    )}
                    {status === "submitted" && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Shimmer className="text-sm">Searching the web…</Shimmer>
                      </div>
                    )}
                  </ConversationContent>
                  <ConversationScrollButton className="absolute bottom-4 right-4" />
                </Conversation>

                <div className="border-t border-border/60 p-4">
                  {messages.length === 1 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((prompt, i) => (
                        <motion.button
                          key={prompt}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i }}
                          whileHover={{ y: -2, scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={() => handlePromptSubmit({ text: prompt, files: [] })}
                          className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {prompt}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  <div ref={composerRef}>
                    <PromptInput
                      onSubmit={handlePromptSubmit}
                      className="flex flex-col gap-2"
                    >
                      <PromptInputTextarea
                        placeholder="Describe your legal situation..."
                        className="min-h-[5rem] resize-none rounded-xl border-border bg-muted/30 px-4 py-3 text-sm focus-visible:bg-card"
                        disabled={isLoading}
                      />
                      <PromptInputFooter className="justify-end">
                        <PromptInputSubmit
                          status={status}
                          onStop={stop}
                          disabled={isLoading}
                          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                        />
                      </PromptInputFooter>
                    </PromptInput>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ChatMessage({
  message,
  isStreaming,
}: {
  message: UIMessage & { role: "assistant" | "user" };
  isStreaming: boolean;
}) {
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");

  return (
    <Message from={message.role} className="py-1">
      <MessageContent
        className={cn(
          "text-sm leading-relaxed",
          message.role === "user" &&
            "group-[.is-user]:!bg-chat-user group-[.is-user]:!text-chat-user-foreground"
        )}
      >
        {message.role === "assistant" ? (
          <MessageResponse isAnimating={isStreaming}>{text}</MessageResponse>
        ) : (
          text
        )}
      </MessageContent>
    </Message>
  );
}

/* ---------------- Trust ---------------- */

function TrustSection() {
  const features = [
    { icon: ShieldCheck, title: "No advice, just guidance", body: "Ally never predicts outcomes or plays lawyer. It clarifies your situation so you can act." },
    { icon: Lock, title: "Zero persistence", body: "Chats live only in your browser tab. Nothing hits our database, ever." },
    { icon: Zap, title: "Real, current results", body: "Every referral is pulled live from the web — no stale directories, no fabricated names." },
    { icon: Globe, title: "Trusted sources", body: "Prioritises Avvo, Martindale-Hubbell, FindLaw, Justia, and Super Lawyers." },
  ];
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealHeader
          eyebrow="Why Ally"
          title={<>Built around <span className="text-gradient-sage">what a good friend</span> who happened to be a lawyer would actually do.</>}
        />
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 perspective-1200">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <TiltCard>
                <div className="h-full rounded-2xl glass-panel p-6">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="mb-1.5 font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Directory (submitted only + CTA) ---------------- */

function DirectorySection({ submissions, onSubmitted }: { submissions: Submission[]; onSubmitted: () => void }) {
  return (
    <section id="directory" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] glass-panel p-8 sm:p-12">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="mesh-orb-a absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
            <div className="mesh-orb-b absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-[oklch(0.78_0.15_85)]/25 blur-3xl" />
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
                For attorneys
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                Are you a lawyer? <span className="text-gradient-sage">List your practice.</span>
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground leading-relaxed">
                Ally connects the people most in need of help with real, verifiable attorneys — never fabricated profiles or stock photos. Submit your details and Ally will surface you to matching users.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ListPracticeDialog
                  specialties={SPECIALTIES}
                  onSubmitted={onSubmitted}
                  trigger={
                    <motion.button
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg"
                    >
                      <Sparkles className="size-4" /> List your practice
                    </motion.button>
                  }
                />
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 text-primary" /> Every submission is manually reviewed before it goes live.
                </span>
              </div>
            </div>

            <div className="perspective-1200">
              <TiltCard>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">Recent submissions</h3>
                    <span className="text-xs text-muted-foreground">
                      {submissions.length} pending
                    </span>
                  </div>
                  {submissions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        No attorney has listed their practice yet. Be the first.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {submissions.slice(0, 4).map((s) => (
                        <SubmissionRow key={s.id} s={s} />
                      ))}
                    </div>
                  )}
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SubmissionRow({ s }: { s: Submission }) {
  const [imgError, setImgError] = useState(false);
  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-3 transition-shadow hover:shadow-md"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-primary/10">
        {!imgError ? (
          <img
            src={s.photoUrl}
            alt={s.name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="size-5 text-primary" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate font-medium">{s.name}</div>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Clock className="size-3" /> Pending review
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {s.title} · {s.location}
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- Reveal helpers ---------------- */

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function RevealHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <Reveal>
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          {eyebrow}
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-4 text-muted-foreground leading-relaxed">{subtitle}</p>
        )}
      </div>
    </Reveal>
  );
}

/* ---------------- Header / Footer ---------------- */

function Header() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const unsub = scrollY.on("change", (v: number) => setScrolled(v > 20));
    return () => unsub();
  }, [scrollY]);
  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/40 bg-background/70 backdrop-blur-xl"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="group flex items-center gap-2.5">
          <motion.img
            whileHover={{ rotate: 12, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
            src={logo}
            alt=""
            className="h-9 w-9"
            width={36}
            height={36}
          />
          <span className="text-lg font-semibold tracking-tight">Ally AI</span>
        </a>
        <nav className="hidden items-center gap-1 text-sm font-medium sm:flex">
          <NavLink href="#how">How it works</NavLink>
          <NavLink href="#chat">Chat</NavLink>
          <NavLink href="#directory">For attorneys</NavLink>
        </nav>
        <motion.a
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          href="#chat"
          className="hidden rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md sm:inline-flex"
        >
          Start chat
        </motion.a>
      </div>
    </motion.header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="relative rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </a>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-6 w-6" width={24} height={24} />
            <span className="font-semibold">Ally AI</span>
          </div>
          <p className="text-center text-xs text-muted-foreground max-w-md">
            Ally AI is not a law firm and does not provide legal advice. We help you find independent attorneys — please verify credentials before hiring.
          </p>
        </div>
      </div>
    </footer>
  );
}

// Motion helper type re-export to satisfy TS if unused
export type _MV = MotionValue<number>;

export default HomePage;
