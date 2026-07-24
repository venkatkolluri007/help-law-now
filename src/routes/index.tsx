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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Building2,
  Clock,
  Copyright,
  FileText,
  Gavel,
  HeartHandshake,
  Home,
  Lock,
  MapPin,
  MessageCircle,
  Scale,
  Search,
  Shield,
  User,
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import logo from "@/assets/legal-guide-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { ListPracticeDialog } from "@/components/list-practice-dialog";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "JustLegal — Guided legal help, just in time" },
      { name: "description", content: "Private, no-persistence chat triage that helps you understand your legal situation and connects you with the right expert." },
      { property: "og:title", content: "JustLegal — Guided legal help, just in time" },
      { property: "og:description", content: "Private, no-persistence chat triage that helps you understand your legal situation and connects you with the right expert." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SPECIALTIES = [
  "All",
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

const EXPERTS = [
  {
    id: "1",
    name: "Sarah Chen",
    title: "Family Law Attorney",
    specialty: "Family Law",
    location: "San Francisco, CA",
    description: "Compassionate counsel for divorce, custody, and adoption matters.",
    icon: HeartHandshake,
    photoUrl: "https://i.pravatar.cc/300?img=26",
  },
  {
    id: "2",
    name: "Marcus Johnson",
    title: "Employment Lawyer",
    specialty: "Employment Law",
    location: "New York, NY",
    description: "Wrongful termination, workplace discrimination, and contract review.",
    icon: User,
    photoUrl: "https://i.pravatar.cc/300?img=59",
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    title: "Immigration Attorney",
    specialty: "Immigration",
    location: "Miami, FL",
    description: "Visas, green cards, naturalization, and deportation defense.",
    icon: MapPin,
    photoUrl: "https://i.pravatar.cc/300?img=42",
  },
  {
    id: "4",
    name: "David Park",
    title: "Personal Injury Attorney",
    specialty: "Personal Injury",
    location: "Chicago, IL",
    description: "Auto accidents, slips and falls, and medical malpractice claims.",
    icon: Shield,
    photoUrl: "https://i.pravatar.cc/300?img=53",
  },
  {
    id: "5",
    name: "Aisha Williams",
    title: "Criminal Defense Attorney",
    specialty: "Criminal Defense",
    location: "Atlanta, GA",
    description: "DUI, misdemeanors, felonies, and expungement support.",
    icon: Gavel,
    photoUrl: "https://i.pravatar.cc/300?img=47",
  },
  {
    id: "6",
    name: "Tom Nakamura",
    title: "Housing & Tenant Lawyer",
    specialty: "Housing",
    location: "Seattle, WA",
    description: "Eviction defense, landlord disputes, and lease reviews.",
    icon: Home,
    photoUrl: "https://i.pravatar.cc/300?img=17",
  },
  {
    id: "7",
    name: "Grace Okafor",
    title: "Estate Planning Attorney",
    specialty: "Wills & Estates",
    location: "Houston, TX",
    description: "Wills, trusts, probate, and powers of attorney.",
    icon: FileText,
    photoUrl: "https://i.pravatar.cc/300?img=32",
  },
  {
    id: "8",
    name: "James Miller",
    title: "Business & Contracts Attorney",
    specialty: "Contracts",
    location: "Austin, TX",
    description: "Business formation, contract drafting, and partnership disputes.",
    icon: Building2,
    photoUrl: "https://randomuser.me/api/portraits/men/13.jpg",
  },
  {
    id: "9",
    name: "Priya Sharma",
    title: "IP Attorney",
    specialty: "Intellectual Property",
    location: "Los Angeles, CA",
    description: "Trademarks, copyrights, patents, and licensing agreements.",
    icon: Copyright,
    photoUrl: "https://i.pravatar.cc/300?img=45",
  },
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
      text: "Hi — I'm here to help you make sense of your legal situation. I won't give legal advice, but I can ask a few questions and point you toward the right expert. What brings you here today?",
    },
  ],
};

type Expert = {
  id: string;
  name: string;
  title: string;
  specialty: string;
  location: string;
  description: string;
  icon: React.ElementType;
  photoUrl: string;
  status: "verified" | "pending";
};

const STATIC_EXPERTS: Expert[] = EXPERTS.map((e) => ({ ...e, status: "verified" as const }));

function HomePage() {
  const [activeSpecialty, setActiveSpecialty] = useState("All");
  const [search, setSearch] = useState("");
  const [submissions, setSubmissions] = useState<Expert[]>([]);
  const chatTransport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: "justlegal-chat",
    transport: chatTransport,
    messages: [WELCOME_MESSAGE],
  });

  const isLoading = status === "submitted" || status === "streaming";

  const composerRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef(status);

  useEffect(() => {
    composerRef.current?.querySelector("textarea")?.focus();
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
        icon: User,
        photoUrl: row.photo_url,
        status: row.status === "verified" ? "verified" : "pending",
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

  const allExperts = useMemo(() => [...STATIC_EXPERTS, ...submissions], [submissions]);

  const filteredExperts = useMemo(() => {
    return allExperts.filter((expert) => {
      const matchesSpecialty =
        activeSpecialty === "All" || expert.specialty === activeSpecialty;
      const matchesSearch =
        search.trim() === "" ||
        expert.name.toLowerCase().includes(search.toLowerCase()) ||
        expert.specialty.toLowerCase().includes(search.toLowerCase()) ||
        expert.location.toLowerCase().includes(search.toLowerCase()) ||
        expert.description.toLowerCase().includes(search.toLowerCase());
      return matchesSpecialty && matchesSearch;
    });
  }, [allExperts, activeSpecialty, search]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Lock className="size-4" />
              <span>Private. No chat history saved.</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Guided legal help,
              <br />
              <span className="text-primary">just in time</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Describe what's happening. We'll help you understand the kind of legal support you need and introduce you to a vetted expert who can guide you forward.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#chat"
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start a chat
              </a>
              <a
                href="#experts"
                className="inline-flex items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Browse experts
              </a>
            </div>
          </div>

          <div className="relative hidden items-center justify-center lg:flex">
            <div className="absolute inset-0 rounded-3xl bg-primary/5 blur-3xl" />
            <img
              src={logo}
              alt="JustLegal — a balanced scale inside a warm shield"
              className="relative h-64 w-64 object-contain"
              width={256}
              height={256}
              loading="eager"
            />
          </div>
        </section>

        <section id="chat" className="pb-20 pt-4">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Scale className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Legal Triage Assistant</h2>
                  <p className="text-xs text-muted-foreground">
                    No messages are stored. This is not legal advice.
                  </p>
                </div>
              </div>

              <Conversation className="h-[28rem]">
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
                      <Shimmer className="text-sm">Thinking...</Shimmer>
                    </div>
                  )}
                </ConversationContent>
                <ConversationScrollButton className="absolute bottom-4 right-4" />
              </Conversation>

              <div className="border-t border-border p-4">
                {messages.length === 1 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handlePromptSubmit({ text: prompt, files: [] })}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {prompt}
                      </button>
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
          </div>
        </section>

        <section id="experts" className="pb-24">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Quick Pick
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                Vetted legal experts
              </h2>
              <p className="mt-2 text-muted-foreground">
                Browse specialists who can help with the issues you describe.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or specialty"
                  className="pl-9"
                />
              </div>
              <ListPracticeDialog
                specialties={SPECIALTIES}
                onSubmitted={loadSubmissions}
                trigger={
                  <Button className="rounded-full">List your practice</Button>
                }
              />
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {SPECIALTIES.map((specialty) => (
              <button
                key={specialty}
                onClick={() => setActiveSpecialty(specialty)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  activeSpecialty === specialty
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {specialty}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredExperts.map((expert) => (
              <ExpertCard key={expert.id} expert={expert} />
            ))}
          </div>

          {filteredExperts.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <p className="text-muted-foreground">No experts match your search.</p>
              <Button
                variant="link"
                onClick={() => {
                  setActiveSpecialty("All");
                  setSearch("");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
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

function ExpertCard({
  expert,
}: {
  expert: {
    name: string;
    title: string;
    specialty: string;
    location: string;
    description: string;
    icon: React.ElementType;
    photoUrl: string;
    status: "verified" | "pending";
  };
}) {
  const [imageError, setImageError] = useState(false);
  const Icon = expert.icon;
  const isPending = expert.status === "pending";
  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md",
        isPending ? "border-dashed border-muted-foreground/30" : "border-border"
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/10">
          {!imageError ? (
            <img
              src={expert.photoUrl}
              alt={expert.name}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <Icon className="size-6 text-primary" />
          )}
        </div>
        {isPending && (
          <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5" />
            Pending review
          </div>
        )}
      </div>
      <h3 className="font-semibold text-foreground">{expert.name}</h3>
      <p className="text-sm text-primary">{expert.title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{expert.description}</p>
      <div className="mt-auto pt-4 text-xs text-muted-foreground">
        {expert.location}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2">
          <img
            src={logo}
            alt=""
            className="h-8 w-8"
            width={32}
            height={32}
            loading="eager"
          />
          <span className="text-lg font-semibold text-foreground">JustLegal</span>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <a href="#chat" className="text-muted-foreground transition-colors hover:text-foreground">
            Chat
          </a>
          <a href="#experts" className="text-muted-foreground transition-colors hover:text-foreground">
            Experts
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt=""
              className="h-6 w-6"
              width={24}
              height={24}
              loading="lazy"
            />
            <span className="font-semibold text-foreground">JustLegal</span>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            JustLegal is not a law firm and does not provide legal advice. We connect you with independent attorneys.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default HomePage;
