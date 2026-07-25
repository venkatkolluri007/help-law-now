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
  Search,
  UserPlus,
  ClipboardList,
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
      { name: "description", content: "A private, no-persistence chat that triages your legal situation and finds real attorneys with live web search." },
      { property: "og:title", content: "Ally AI — Guided legal help, just in time" },
      { property: "og:description", content: "A private, no-persistence chat that triages your legal situation and finds real attorneys with live web search." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SPECIALTIES = [
  "Family Law", "Employment Law", "Immigration", "Personal Injury",
  "Criminal Defense", "Housing", "Wills & Estates", "Contracts", "Intellectual Property",
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
  parts: [{
    type: "text",
    text: "Hi — I'm here to help you make sense of your legal situation. I won't give legal advice, but I can ask a few questions and search the web for real attorneys who match. What brings you here today?",
  }],
};

type Submission = {
  id: string; name: string; title: string; specialty: string;
  location: string; description: string; photoUrl: string;
};

function HomePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const chatTransport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, stop } = useChat({
    id: "ally-ai-chat", transport: chatTransport, messages: [WELCOME_MESSAGE],
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
      composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true });
    }
    previousStatusRef.current = status;
  }, [status]);

  const loadSubmissions = async () => {
    const { data, error } = await supabase
      .from("attorney_submissions").select("*").order("created_at", { ascending: false });
    if (error) { console.error("Failed to load submissions", error); return; }
    setSubmissions((data ?? []).map((row) => ({
      id: `sub-${row.id}`, name: row.full_name, title: row.title,
      specialty: row.specialty, location: row.location,
      description: row.description, photoUrl: row.photo_url,
    })));
  };
  useEffect(() => { loadSubmissions(); }, []);

  const handlePromptSubmit = async ({ text }: { text: string; files: unknown[] }) => {
    if (!text.trim() || isLoading) return;
    await sendMessage({ text: text.trim() });
  };

  return (
    <div className="relative min-h-screen" style={{ background: "#f7f5f0" }}>
      {/* Ambient page-level glow bleeding around the frame */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-20 -left-20 h-[46rem] w-[46rem] rounded-full mesh-orb-a"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.15 55 / 0.85), transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-1/3 -right-32 h-[50rem] w-[50rem] rounded-full mesh-orb-b"
          style={{ background: "radial-gradient(circle, oklch(0.6 0.12 200 / 0.8), transparent 70%)", filter: "blur(70px)" }} />
        <div className="absolute bottom-0 left-1/4 h-[38rem] w-[38rem] rounded-full mesh-orb-a"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.12 340 / 0.6), transparent 70%)", filter: "blur(70px)" }} />
        <div className="absolute -bottom-24 right-1/4 h-[36rem] w-[36rem] rounded-full mesh-orb-b"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.15 55 / 0.55), transparent 70%)", filter: "blur(70px)" }} />
      </div>

      {/* Floating frame with ambient glow bleeding outside */}
      <div className="relative z-10 mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-8 pt-4 pb-10">
        <div className="relative">
          <div className="ambient-glow" />
          <div className="ambient-frame">
            <Header />
            <Hero onQuickStart={() => document.getElementById("chat")?.scrollIntoView({ behavior: "smooth" })} />
            <RunwayStrip />
            <WhyAllySection />
            <HowItWorks />
            <ChatSection
              messages={messages} status={status} stop={stop}
              isLoading={isLoading} composerRef={composerRef}
              handlePromptSubmit={handlePromptSubmit}
            />
            <DirectorySection submissions={submissions} onSubmitted={loadSubmissions} />
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- HEADER ---------------- */

function Header() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
      className="sticky top-3 z-50 px-3 pt-3 sm:px-5"
    >
      <div className="pill-nav mx-auto flex max-w-6xl items-center justify-between gap-4 px-3 py-2 sm:px-4">
        <a href="/" className="group flex items-center gap-2.5 pl-2">
          <motion.img
            whileHover={{ rotate: 12, scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}
            src={logo} alt="" className="h-8 w-8" width={32} height={32}
          />
          <span className="text-base font-semibold tracking-tight text-foreground">Ally AI</span>
        </a>
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          <NavLink href="#why">Why Ally</NavLink>
          <NavLink href="#how">How it works</NavLink>
          <NavLink href="#chat">Chat</NavLink>
          <NavLink href="#directory">For attorneys</NavLink>
        </nav>
        <motion.a
          whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }}
          href="#chat"
          className="white-pill white-pill-hover inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
        >
          Start chat <ArrowRight className="size-4" />
        </motion.a>
      </div>
    </motion.header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground">
      {children}
    </a>
  );
}

/* ---------------- HERO ---------------- */

function Hero({ onQuickStart }: { onQuickStart: () => void }) {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 600], [0, -80]);
  const y2 = useTransform(scrollY, [0, 600], [0, -160]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0.4]);

  return (
    <section className="relative isolate overflow-hidden pt-16 pb-24 sm:pt-24 lg:pt-28 lg:pb-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-soft opacity-70" />
        <motion.div style={{ y: y2 }} className="mesh-orb-a absolute -top-24 left-1/4 h-96 w-96 rounded-full blur-3xl" aria-hidden />
      </div>

      <motion.div style={{ opacity }} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          {/* Left copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-7"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium"
              style={{ background: "color-mix(in oklab, oklch(0.72 0.15 55) 12%, transparent)", border: "1px solid color-mix(in oklab, oklch(0.72 0.15 55) 35%, transparent)", color: "oklch(0.45 0.12 30)" }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "var(--accent-warm)" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--accent-warm)" }} />
              </span>
              Private · Nothing saved · Live web search
            </motion.div>

            <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl lg:text-[4.5rem] leading-[1.02]">
              Guided legal help,
              <br />
              <span className="text-gradient-warm">just in time.</span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Describe what's happening in plain language. Ally AI triages your situation, then searches the live web across real attorney directories to surface actual lawyers you can vet yourself.
            </p>

            <ScalesOfJustice
              onLeft={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
              onRight={onQuickStart}
            />



            <div className="flex flex-wrap gap-8 pt-4">
              <StatChip value="15K+" label="Attorneys reachable via live search" />
              <StatChip value="0s" label="Chat retention" />
              <StatChip value="4" label="Directories crawled per query" />
            </div>
          </motion.div>

          {/* Right: floating tilted mockup */}
          <motion.div
            style={{ y: y1 }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative mx-auto w-full max-w-lg perspective-1200"
          >
            <div style={{ transform: "rotateX(6deg) rotateY(-10deg)", transformStyle: "preserve-3d" }}>
              <TiltCard>
                <div className="relative rounded-3xl glass-card p-5 sm:p-6"
                  style={{ boxShadow: "0 60px 120px -30px rgba(30,40,60,0.18), 0 0 60px -10px oklch(0.72 0.15 55 / 0.35)" }}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                      <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent-warm)" }} />
                    </div>
                    <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                      <Scale className="size-3.5" /> Ally · Triage
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <FakeBubble side="user">I need a family lawyer in Seattle, budget ~$2,500.</FakeBubble>
                    <FakeBubble side="assistant" delay={0.4}>Got it. Searching Avvo, Justia & Super Lawyers now…</FakeBubble>
                    <FakeBubble side="assistant" delay={1.1}>
                      <span className="flex items-center gap-2 font-medium">
                        <Globe className="size-4" style={{ color: "var(--accent-teal)" }} /> 4 real matches found
                      </span>
                    </FakeBubble>
                  </div>
                  <div className="mt-5 rounded-2xl p-3 text-xs text-muted-foreground"
                    style={{ background: "rgba(30,40,60,0.04)", border: "1px solid rgba(30,40,60,0.09)" }}>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium"
                      style={{ background: "color-mix(in oklab, var(--accent-teal) 18%, transparent)", color: "oklch(0.4 0.1 200)" }}>
                      <Lock className="size-3" /> Ephemeral
                    </span>{" "}
                    This conversation is not stored anywhere.
                  </div>
                </div>
              </TiltCard>
            </div>

            {/* Floating micro-cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="absolute -left-6 top-16 float-3d-slow"
              aria-hidden
            >
              <div className="glass-card rounded-2xl px-3.5 py-2.5 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <Search className="size-3.5" style={{ color: "var(--accent-warm)" }} />
                  <span>Live search</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">avvo.com · justia.com</div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="absolute -right-2 bottom-16 float-3d"
              aria-hidden
            >
              <div className="glass-card rounded-2xl px-3.5 py-2.5 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5" style={{ color: "var(--accent-sage)" }} />
                  <span>Zero persistence</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">0s retention</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tracking-tight text-gradient-warm">{value}</span>
      <span className="text-xs uppercase tracking-wider text-muted-foreground/80 max-w-[10rem]">{label}</span>
    </div>
  );
}

function FakeBubble({ side, children, delay = 0 }: { side: "user" | "assistant"; children: React.ReactNode; delay?: number }) {
  const isUser = side === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 + delay, duration: 0.5 }}
      className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", isUser ? "ml-auto text-white" : "mr-auto text-foreground")}
      style={isUser
        ? { background: "linear-gradient(135deg, oklch(0.55 0.12 200), oklch(0.55 0.13 220))" }
        : { background: "rgba(30,40,60,0.06)", border: "1px solid rgba(30,40,60,0.09)" }
      }
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Scales of justice hero CTA ---------------- */

function ScalesOfJustice({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) {
  // side = which pan has "landed" (visibly heavier)
  const [side, setSide] = useState<null | "left" | "right">(null);
  const [pressed, setPressed] = useState<null | "left" | "right">(null);
  const tiltDeg = side === "left" ? -10 : side === "right" ? 10 : 0;

  const activate = (which: "left" | "right", cb: () => void) => {
    if (pressed) return;
    setPressed(which);
    setSide(which);
    // Auto-scroll after the tilt lands
    window.setTimeout(() => {
      cb();
    }, 550);
    // Reset the visual after scroll starts so users can try again
    window.setTimeout(() => {
      setPressed(null);
      setSide(null);
    }, 1600);
  };

  const beamSpring = { type: "spring" as const, stiffness: 120, damping: 12, mass: 1.1 };
  const panSpring = { type: "spring" as const, stiffness: 140, damping: 14, mass: 1 };
  const leftDrop = side === "left" ? 22 : side === "right" ? -18 : 0;
  const rightDrop = side === "right" ? 22 : side === "left" ? -18 : 0;

  return (
    <div className="relative select-none" role="group" aria-label="Choose a path">
      <div className="relative mx-auto flex w-full max-w-xl items-start justify-center pt-6 pb-40 min-h-[240px]">
        {/* Beam pivot layer */}
        <motion.div
          className="relative flex w-full items-start justify-center"
          animate={{ rotate: tiltDeg }}
          transition={beamSpring}
          style={{ transformOrigin: "50% 34px" }}
        >
          {/* The beam */}
          <div
            className="relative h-2.5 w-[420px] max-w-full rounded-full"
            style={{
              background: "linear-gradient(90deg, var(--accent-teal), var(--accent-warm))",
              boxShadow: "0 6px 16px -6px rgba(30,40,60,0.25), inset 0 1px 0 rgba(255,255,255,0.55)",
            }}
          >
            {/* Beam highlight */}
            <div className="absolute inset-x-4 top-0 h-px rounded-full bg-white/60" />
          </div>

          {/* Chains + pans */}
          <PanArm
            sideLabel="How it works"
            sublabel="See the flow"
            accent="teal"
            anchor="left"
            drop={leftDrop}
            landed={side === "left"}
            spring={panSpring}
            onActivate={() => activate("left", onLeft)}
          />
          <PanArm
            sideLabel="Start a private chat"
            sublabel="Nothing saved"
            accent="warm"
            anchor="right"
            drop={rightDrop}
            landed={side === "right"}
            spring={panSpring}
            onActivate={() => activate("right", onRight)}
          />
        </motion.div>

        {/* Fulcrum / stand */}
        <div className="pointer-events-none absolute left-1/2 top-[24px] -translate-x-1/2 flex flex-col items-center">
          <div
            className="h-4 w-4 rounded-full"
            style={{
              background: "radial-gradient(circle at 35% 30%, #fff, var(--accent-teal) 70%)",
              boxShadow: "0 4px 10px -2px rgba(30,40,60,0.35)",
            }}
          />
          <div
            className="mt-1 h-16 w-2 rounded-full"
            style={{
              background: "linear-gradient(180deg, color-mix(in oklab, var(--foreground) 45%, transparent), color-mix(in oklab, var(--foreground) 25%, transparent))",
            }}
          />
          <div
            className="h-2 w-28 rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--foreground) 30%, transparent), transparent)",
              filter: "blur(0.5px)",
            }}
          />
          {/* Soft ground shadow */}
          <div
            className="mt-3 h-3 w-40 rounded-full"
            style={{
              background: "radial-gradient(ellipse at center, rgba(30,40,60,0.18), transparent 70%)",
              filter: "blur(2px)",
            }}
          />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Tip the scale — pick a side to begin.
      </p>
    </div>
  );
}

function PanArm({
  sideLabel, sublabel, accent, anchor, drop, landed, spring, onActivate,
}: {
  sideLabel: string;
  sublabel: string;
  accent: "teal" | "warm";
  anchor: "left" | "right";
  drop: number;
  landed: boolean;
  spring: { type: "spring"; stiffness: number; damping: number; mass: number };
  onActivate: () => void;
}) {
  const color = accent === "teal" ? "var(--accent-teal)" : "var(--accent-warm)";
  const gradient = accent === "teal"
    ? "linear-gradient(140deg, color-mix(in oklab, var(--accent-teal) 20%, white), white 70%)"
    : "linear-gradient(140deg, color-mix(in oklab, var(--accent-warm) 22%, white), white 70%)";
  const posClass = anchor === "left" ? "absolute left-0 -translate-x-2" : "absolute right-0 translate-x-2";

  return (
    <div className={`${posClass} top-2 flex flex-col items-center`} style={{ width: 168 }}>
      {/* Chain */}
      <motion.div
        className="flex flex-col items-center"
        animate={{ y: drop }}
        transition={spring}
      >
        <div className="flex h-14 flex-col items-center justify-between py-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "color-mix(in oklab, var(--foreground) 40%, transparent)" }} />
          <span className="h-1 w-1 rounded-full" style={{ background: "color-mix(in oklab, var(--foreground) 30%, transparent)" }} />
          <span className="h-1 w-1 rounded-full" style={{ background: "color-mix(in oklab, var(--foreground) 30%, transparent)" }} />
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "color-mix(in oklab, var(--foreground) 40%, transparent)" }} />
        </div>

        {/* Pan (button) */}
        <motion.button
          type="button"
          onClick={onActivate}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          className="relative rounded-[999px] px-5 py-3 text-sm font-semibold shadow-md focus:outline-none focus-visible:ring-2"
          style={{
            background: gradient,
            border: `1px solid ${color}`,
            color: "var(--foreground)",
            minWidth: 156,
            boxShadow: `0 12px 24px -12px ${color}, 0 1px 0 rgba(255,255,255,0.7) inset`,
          }}
          aria-label={sideLabel}
        >
          <span className="block leading-tight">{sideLabel}</span>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {sublabel}
          </span>

          {/* Landing glow */}
          {landed && (
            <motion.span
              initial={{ opacity: 0.9, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 rounded-[999px]"
              style={{ boxShadow: `0 0 40px 8px ${color}`, background: `radial-gradient(circle, ${color}22, transparent 70%)` }}
            />
          )}
        </motion.button>

        {/* Pan bowl underline arc */}
        <div
          className="mt-0.5 h-1.5 w-24 rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.55 }}
        />
      </motion.div>
    </div>
  );
}


function RunwayStrip() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="relative h-24">
        {/* Neon line */}
        <div className="absolute left-0 right-0 top-1/2 neon-runway" />
        {/* Reflection */}
        <div className="absolute left-0 right-0 top-1/2 h-16"
          style={{
            background: "linear-gradient(180deg, oklch(0.72 0.15 55 / 0.12), transparent 80%)",
            filter: "blur(6px)",
            transform: "translateY(2px) scaleY(-1)",
          }} />
        {/* Floating orbs */}
        <motion.div
          className="absolute left-[18%] top-2 orb-bob"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          <div className="h-8 w-8 rounded-lg"
            style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 55), oklch(0.55 0.22 300))", boxShadow: "0 10px 30px -5px oklch(0.72 0.15 55 / 0.7)", transform: "rotate(20deg)" }} />
        </motion.div>
        <motion.div
          className="absolute left-[48%] -top-2 orb-bob"
          style={{ animationDelay: "1.5s" }}
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          <div className="h-6 w-6 rounded-full"
            style={{ background: "radial-gradient(circle at 30% 30%, oklch(0.45 0.11 200), oklch(0.55 0.13 220))", boxShadow: "0 10px 30px -5px oklch(0.6 0.12 200 / 0.7)" }} />
        </motion.div>
        <motion.div
          className="absolute right-[15%] top-4 orb-bob"
          style={{ animationDelay: "3s" }}
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          <div className="h-10 w-10 rounded-2xl"
            style={{ background: "linear-gradient(135deg, oklch(0.55 0.12 340), oklch(0.55 0.12 200))", boxShadow: "0 10px 30px -5px oklch(0.55 0.12 340 / 0.7)", transform: "rotate(-15deg)" }} />
        </motion.div>
      </div>
    </div>
  );
}

/* ---------------- Tilt card wrapper ---------------- */

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 10); rotateX.set(-py * 10);
  };
  const handleLeave = () => { rotateX.set(0); rotateY.set(0); };
  return (
    <motion.div
      ref={ref} onMouseMove={handleMouseMove} onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={cn("relative", className)}
    >{children}</motion.div>
  );
}

/* ---------------- WHY ALLY (editorial with chips) ---------------- */

function WhyAllySection() {
  const features = [
    { icon: ShieldCheck, title: "No advice, just guidance", body: "Ally never predicts outcomes or plays lawyer. It clarifies your situation so you can act." },
    { icon: Lock, title: "Zero persistence", body: "Chats live only in your browser tab. Nothing hits our database, ever." },
    { icon: Zap, title: "Real, current results", body: "Every referral is pulled live from the web — no stale directories, no fabricated names." },
  ];
  return (
    <section id="why" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          {/* Editorial column */}
          <Reveal>
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
              style={{ background: "color-mix(in oklab, var(--accent-warm) 12%, transparent)", color: "oklch(0.5 0.12 30)", border: "1px solid color-mix(in oklab, var(--accent-warm) 25%, transparent)" }}>
              Why Ally
            </div>
            <p className="text-3xl sm:text-4xl font-medium leading-[1.25] tracking-tight text-foreground/95">
              Legal help usually feels like the wrong shape of the problem. Ally is a{" "}
              <span className="chip-warm" style={{ color: "oklch(0.5 0.12 30)" }}>live web search</span>{" "}
              triage agent that talks like a friend, points you at{" "}
              <span className="chip-warm" style={{ color: "oklch(0.88 0.15 145)" }}>real attorneys</span>{" "}
              pulled from actual directories, and keeps{" "}
              <span className="chip-warm" style={{ color: "oklch(0.4 0.1 200)" }}>zero persistence</span>{" "}
              of what you share. There are{" "}
              <span className="chip-warm" style={{ color: "oklch(0.5 0.12 55)" }}>no fabricated names</span>,
              no stock photos, and no legal advice — just a shorter path from confusion to the right expert.
            </p>
            <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px w-10 bg-black/15" />
              Built for people in a bad moment who need a good next step.
            </div>
          </Reveal>

          {/* Right: glowing 3D orb + feature cards */}
          <div className="relative">
            <div className="relative mx-auto mb-8 h-56 w-56 perspective-1200">
              <motion.div
                animate={{ rotate: 360 }} transition={{ duration: 40, ease: "linear", repeat: Infinity }}
                className="absolute inset-0 rounded-full"
                style={{ background: "conic-gradient(from 0deg, oklch(0.72 0.15 55), oklch(0.55 0.12 340), oklch(0.6 0.12 200), oklch(0.72 0.15 55))", filter: "blur(30px)", opacity: 0.7 }}
              />
              <motion.div
                animate={{ y: [0, -14, 0], rotate: [0, 8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-6 rounded-full"
                style={{
                  background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), oklch(0.55 0.12 200) 40%, oklch(0.35 0.08 220) 100%)",
                  boxShadow: "0 40px 80px -20px oklch(0.55 0.22 320 / 0.7), inset -10px -20px 40px rgba(30,40,60,0.1), inset 10px 10px 30px rgba(255,255,255,0.3)",
                }}
              />
              <motion.div
                animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-4 -right-4 h-14 w-14 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, oklch(0.6 0.12 200), oklch(0.55 0.12 220))",
                  boxShadow: "0 20px 40px -10px oklch(0.6 0.12 200 / 0.7)",
                  transform: "rotate(15deg)",
                }}
              />
            </div>

            <div className="grid gap-3">
              {features.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.1}>
                  <div className="glass-card rounded-2xl p-4 flex gap-3.5 items-start">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 55 / 0.25), oklch(0.6 0.12 200 / 0.25))", border: "1px solid rgba(30,40,60,0.09)" }}>
                      <f.icon className="size-4.5" style={{ color: "oklch(0.4 0.1 260)" }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{f.title}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{f.body}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- HOW IT WORKS (pill tab + product mockup) ---------------- */

function HowItWorks() {
  const steps = [
    { id: "chat", label: "Chat & triage", icon: MessageCircle },
    { id: "search", label: "Live web search", icon: Search },
    { id: "list", label: "For attorneys", icon: UserPlus },
  ] as const;
  const [active, setActive] = useState<(typeof steps)[number]["id"]>("chat");

  return (
    <section id="how" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <RevealHeader
          eyebrow="How it works"
          title={<>A calm interface. <span className="text-gradient-warm">A live search under the hood.</span></>}
          subtitle="Three connected surfaces do the whole job — one chat, one live-web search agent, one self-serve door for real attorneys."
        />

        {/* Pill tab switcher */}
        <Reveal>
          <div className="mt-10 flex justify-center">
            <div className="pill-nav inline-flex items-center gap-1 p-1.5">
              {steps.map((s) => {
                const isActive = active === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    className={cn(
                      "relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <motion.div layoutId="tab-pill"
                        className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(180deg, var(--accent-teal), var(--accent-warm))" }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      />
                    )}
                    <span className="relative flex items-center gap-2">
                      <s.icon className="size-4" />
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Browser mockup frame */}
        <Reveal delay={0.15}>
          <div className="mt-10 perspective-1200">
            <div style={{ transform: "rotateX(3deg)", transformStyle: "preserve-3d" }} className="mx-auto">
              <div className="browser-frame"
                style={{ boxShadow: "0 60px 120px -30px rgba(30,40,60,0.18), 0 0 100px -20px oklch(0.72 0.15 55 / 0.3)" }}>
                {/* browser chrome */}
                <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-black/10" />
                  <span className="h-3 w-3 rounded-full bg-black/10" />
                  <span className="h-3 w-3 rounded-full bg-black/10" />
                  <div className="ml-4 flex-1 rounded-md px-3 py-1 text-xs text-muted-foreground"
                    style={{ background: "rgba(30,40,60,0.05)", border: "1px solid rgba(30,40,60,0.09)" }}>
                    ally.ai/chat
                  </div>
                </div>
                <div className="p-6 sm:p-8">
                  {active === "chat" && <MockupChat />}
                  {active === "search" && <MockupSearch />}
                  {active === "list" && <MockupList />}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function MockupChat() {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
      <div className="glass-card rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <MessageCircle className="size-3.5" /> Conversation
        </div>
        <div className="space-y-2">
          <FakeBubble side="user">My employer fired me two days after I asked about overtime.</FakeBubble>
          <FakeBubble side="assistant" delay={0.1}>That sounds hard. Was there anything in writing about the overtime request?</FakeBubble>
          <FakeBubble side="user" delay={0.2}>Just emails.</FakeBubble>
          <FakeBubble side="assistant" delay={0.3}>Save those. What state are you in?</FakeBubble>
        </div>
      </div>
      <div className="glass-card rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardList className="size-3.5" /> Triage panel
        </div>
        <div className="space-y-2">
          <MockRow label="Likely area" value="Employment · Retaliation" tone="pink" />
          <MockRow label="Urgency" value="Within 30 days" tone="orange" />
          <MockRow label="Next step" value="Consult employment attorney" tone="cyan" />
          <MockRow label="Retention" value="0 seconds" tone="green" />
        </div>
      </div>
    </div>
  );
}
function MockupSearch() {
  const results = [
    { firm: "Wakefield Employment Law", loc: "Seattle, WA", src: "avvo.com", tone: "pink" as const },
    { firm: "North Ave Legal Group", loc: "Seattle, WA", src: "justia.com", tone: "cyan" as const },
    { firm: "Marlowe & Reyes LLP", loc: "Bellevue, WA", src: "superlawyers.com", tone: "purple" as const },
    { firm: "Harborline Employment Advocates", loc: "Tacoma, WA", src: "findlaw.com", tone: "green" as const },
  ];
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="size-3.5" /> Searching "employment retaliation attorney Seattle" across 4 directories…
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {results.map((r) => (
          <div key={r.firm} className="glass-card rounded-xl p-3.5 flex items-start gap-3">
            <div className="mt-0.5 h-2 w-2 rounded-full" style={{ background: toneColor(r.tone), boxShadow: `0 0 10px ${toneColor(r.tone)}` }} />
            <div>
              <div className="text-sm font-semibold">{r.firm}</div>
              <div className="text-xs text-muted-foreground">{r.loc} · via {r.src}</div>
            </div>
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  );
}
function MockupList() {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
      <div className="glass-card rounded-2xl p-4">
        <div className="mb-3 text-xs text-muted-foreground">List your practice</div>
        <div className="space-y-2.5">
          {["Full name", "Title", "Specialty", "Location", "Short description", "Profile photo"].map((f) => (
            <div key={f} className="rounded-lg px-3 py-2 text-sm"
              style={{ background: "rgba(30,40,60,0.05)", border: "1px solid rgba(30,40,60,0.09)" }}>
              <span className="text-muted-foreground">{f}</span>{" "}
              <span style={{ color: "oklch(0.85 0.18 340)" }}>*</span>
            </div>
          ))}
        </div>
      </div>
      <div className="glass-card rounded-2xl p-4">
        <div className="mb-3 text-xs text-muted-foreground">Preview</div>
        <div className="rounded-xl p-4" style={{ background: "rgba(30,40,60,0.04)", border: "1px solid rgba(30,40,60,0.09)" }}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full" style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 55), oklch(0.55 0.12 340))" }} />
            <div>
              <div className="text-sm font-semibold">Your name</div>
              <div className="text-xs text-muted-foreground">Employment attorney · Seattle</div>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: "rgba(30,40,60,0.09)", color: "oklch(0.4 0.02 260)" }}>
            <Clock className="size-3" /> Pending review
          </div>
        </div>
      </div>
    </div>
  );
}
function MockRow({ label, value, tone }: { label: string; value: string; tone: "pink"|"cyan"|"green"|"orange"|"purple" }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2"
      style={{ background: "rgba(30,40,60,0.04)", border: "1px solid rgba(30,40,60,0.09)" }}>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm font-medium" style={{ color: toneColor(tone) }}>{value}</span>
    </div>
  );
}
function toneColor(t: "pink"|"cyan"|"green"|"orange"|"purple") {
  return t === "pink" ? "oklch(0.5 0.12 30)"
    : t === "cyan" ? "oklch(0.4 0.1 200)"
    : t === "green" ? "oklch(0.4 0.1 145)"
    : t === "orange" ? "oklch(0.5 0.12 55)"
    : "oklch(0.5 0.12 300)";
}

/* ---------------- Chat ---------------- */

function ChatSection({
  messages, status, stop, isLoading, composerRef, handlePromptSubmit,
}: {
  messages: UIMessage[];
  status: ReturnType<typeof useChat>["status"];
  stop: () => void; isLoading: boolean;
  composerRef: React.RefObject<HTMLDivElement | null>;
  handlePromptSubmit: (v: { text: string; files: unknown[] }) => void;
}) {
  return (
    <section id="chat" className="relative py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.15 55 / 0.18), transparent 70%)" }} />
      </div>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <RevealHeader
          eyebrow="Chat"
          title={<>Talk it through. <span className="text-gradient-warm">In private.</span></>}
          subtitle="No account. No history. Nothing stored. When you close this tab, this conversation is gone."
        />

        <Reveal>
          <div className="mt-12">
            <div className="browser-frame overflow-hidden"
              style={{ boxShadow: "0 60px 120px -30px rgba(30,40,60,0.18), 0 0 80px -20px oklch(0.72 0.15 55 / 0.25)" }}>
              <div className="flex items-center gap-3 border-b border-black/10 px-5 py-4"
                style={{ background: "linear-gradient(90deg, oklch(0.72 0.15 55 / 0.08), transparent)" }}>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in oklab, var(--accent-warm) 20%, transparent)" }}>
                  <Scale className="size-5" style={{ color: "oklch(0.45 0.12 30)" }} />
                  <span className="absolute inset-0 rounded-full animate-ping" style={{ border: "2px solid oklch(0.72 0.15 55 / 0.4)" }} />
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
                          key={message.id} message={message}
                          isStreaming={status === "streaming" && message.id === messages[messages.length - 1]?.id}
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

              <div className="border-t border-black/10 p-4">
                {messages.length === 1 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt, i) => (
                      <motion.button
                        key={prompt}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i }}
                        whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => handlePromptSubmit({ text: prompt, files: [] })}
                        className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        style={{ background: "rgba(30,40,60,0.05)", border: "1px solid rgba(30,40,60,0.1)" }}
                      >
                        {prompt}
                      </motion.button>
                    ))}
                  </div>
                )}

                <div ref={composerRef}>
                  <PromptInput onSubmit={handlePromptSubmit} className="flex flex-col gap-2">
                    <PromptInputTextarea
                      placeholder="Describe your legal situation..."
                      className="min-h-[5rem] resize-none rounded-xl border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-black/[0.05]"
                      disabled={isLoading}
                    />
                    <PromptInputFooter className="justify-end">
                      <PromptInputSubmit
                        status={status} onStop={stop} disabled={isLoading}
                        className="white-pill white-pill-hover "
                      />
                    </PromptInputFooter>
                  </PromptInput>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ChatMessage({
  message, isStreaming,
}: { message: UIMessage & { role: "assistant" | "user" }; isStreaming: boolean }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  return (
    <Message from={message.role} className="py-1">
      <MessageContent
        className={cn(
          "text-sm leading-relaxed",
          message.role === "user" && "group-[.is-user]:!bg-chat-user group-[.is-user]:!text-chat-user-foreground"
        )}
      >
        {message.role === "assistant"
          ? <MessageResponse isAnimating={isStreaming}>{text}</MessageResponse>
          : text}
      </MessageContent>
    </Message>
  );
}

/* ---------------- Directory (For attorneys) ---------------- */

function DirectorySection({ submissions, onSubmitted }: { submissions: Submission[]; onSubmitted: () => void }) {
  return (
    <section id="directory" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] glass-panel p-8 sm:p-12">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="mesh-orb-a absolute -right-32 -top-32 h-96 w-96 rounded-full blur-3xl"
              style={{ background: "oklch(0.72 0.15 55 / 0.25)" }} />
            <div className="mesh-orb-b absolute -left-24 bottom-0 h-80 w-80 rounded-full blur-3xl"
              style={{ background: "oklch(0.6 0.12 200 / 0.25)" }} />
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                style={{ background: "color-mix(in oklab, var(--accent-teal) 15%, transparent)", color: "oklch(0.4 0.1 200)", border: "1px solid color-mix(in oklab, var(--accent-teal) 30%, transparent)" }}>
                For attorneys
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                Are you a lawyer? <span className="text-gradient-warm">List your practice.</span>
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground leading-relaxed">
                Ally connects people who need help with real, verifiable attorneys — never fabricated profiles or stock photos. Submit your details and Ally will surface you to matching users.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ListPracticeDialog
                  specialties={SPECIALTIES}
                  onSubmitted={onSubmitted}
                  trigger={
                    <motion.button
                      whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}
                      className="white-pill white-pill-hover inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold"
                    >
                      <Sparkles className="size-4" /> List your practice
                    </motion.button>
                  }
                />
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4" style={{ color: "var(--accent-teal)" }} /> Every submission is manually reviewed before it goes live.
                </span>
              </div>
            </div>

            <div>
              <div className="rounded-2xl p-6" style={{ background: "rgba(30,40,60,0.04)", border: "1px solid rgba(30,40,60,0.09)" }}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">Recent submissions</h3>
                  <span className="text-xs text-muted-foreground">{submissions.length} pending</span>
                </div>
                {submissions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-black/10 py-10 text-center">
                    <p className="text-sm text-muted-foreground">No attorney has listed their practice yet. Be the first.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissions.slice(0, 4).map((s) => <SubmissionRow key={s.id} s={s} />)}
                  </div>
                )}
              </div>
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
      className="flex items-center gap-4 rounded-xl p-3 transition-shadow hover:shadow-md"
      style={{ background: "rgba(30,40,60,0.05)", border: "1px solid rgba(30,40,60,0.09)" }}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full" style={{ background: "rgba(30,40,60,0.09)" }}>
        {!imgError ? (
          <img src={s.photoUrl} alt={s.name} className="h-full w-full object-cover" loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><User className="size-5 text-muted-foreground" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate font-medium">{s.name}</div>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            style={{ background: "rgba(30,40,60,0.07)" }}>
            <Clock className="size-3" /> Pending review
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground">{s.title} · {s.location}</div>
      </div>
    </motion.div>
  );
}

/* ---------------- Reveal helpers ---------------- */

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >{children}</motion.div>
  );
}

function RevealHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: React.ReactNode; subtitle?: string }) {
  return (
    <Reveal>
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
          style={{ background: "rgba(30,40,60,0.07)", color: "oklch(0.4 0.08 260)", border: "1px solid rgba(30,40,60,0.1)" }}>
          {eyebrow}
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">{title}</h2>
        {subtitle && <p className="mt-4 text-muted-foreground leading-relaxed">{subtitle}</p>}
      </div>
    </Reveal>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  return (
    <footer className="border-t border-black/10">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
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

export type _MV = MotionValue<number>;
export default HomePage;
