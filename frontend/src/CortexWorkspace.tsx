
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  Database,
  FileSearch,
  Files,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import KnowledgeBase from "./knowledge/KnowledgeBase";
import IntelligentSearch from "./search/IntelligentSearch";
import AIAssistant from "./assistant/AIAssistant";

type Page = "overview" | "knowledge" | "search" | "assistant";

type User = {
  id: string;
  email: string;
  created_at?: string;
};

type CortexWorkspaceProps = {
  accessToken: string;
  user: User;
  onLogout: () => void;
};

type DocumentRecord = {
  id: string;
  filename: string;
  status: string;
  word_count: number;
  size_bytes: number;
};

type DashboardStats = {
  totalDocuments: number;
  indexedDocuments: number;
  totalWords: number;
  storageBytes: number;
};

type NavigationItem = {
  id: Page;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
};

const navigation: NavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Workspace dashboard",
  },
  {
    id: "knowledge",
    label: "Knowledge Base",
    icon: Database,
    description: "Manage your documents",
  },
  {
    id: "search",
    label: "Intelligent Search",
    icon: FileSearch,
    description: "Hybrid and semantic retrieval",
  },
  {
    id: "assistant",
    label: "AI Assistant",
    icon: BrainCircuit,
    description: "Knowledge-grounded answers",
  },
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function normalizeDocuments(payload: unknown): DocumentRecord[] {
  let items: unknown = payload;

  if (
    !Array.isArray(payload) &&
    typeof payload === "object" &&
    payload !== null
  ) {
    const object = payload as Record<string, unknown>;

    items =
      object.documents ??
      object.items ??
      object.results;
  }

  if (!Array.isArray(items)) {
    throw new Error("Unexpected document list response.");
  }

  return items.map((value) => {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value)
    ) {
      throw new Error("Invalid document record.");
    }

    const item = value as Record<string, unknown>;

    if (
      typeof item.id !== "string" ||
      typeof item.filename !== "string"
    ) {
      throw new Error("Document record is missing required fields.");
    }

    return {
      id: item.id,
      filename: item.filename,
      status:
        typeof item.status === "string"
          ? item.status
          : "unknown",
      word_count:
        typeof item.word_count === "number"
          ? item.word_count
          : 0,
      size_bytes:
        typeof item.size_bytes === "number"
          ? item.size_bytes
          : 0,
    };
  });
}

function calculateStats(
  documents: DocumentRecord[]
): DashboardStats {
  const indexedStatuses = new Set([
    "processed",
    "indexed",
    "completed",
  ]);

  return {
    totalDocuments: documents.length,

    indexedDocuments: documents.filter((document) =>
      indexedStatuses.has(
        document.status.trim().toLowerCase()
      )
    ).length,

    totalWords: documents.reduce(
      (total, document) => total + document.word_count,
      0
    ),

    storageBytes: documents.reduce(
      (total, document) => total + document.size_bytes,
      0
    ),
  };
}

function FeatureCard({
  icon,
  title,
  description,
  action,
  onClick,
  accent = "violet",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  accent?: "violet" | "cyan" | "emerald";
}) {
  const accents = {
    violet: {
      icon: "bg-violet-500/10 text-violet-300 border-violet-400/20",
      hover: "hover:border-violet-400/30",
    },
    cyan: {
      icon: "bg-cyan-500/10 text-cyan-300 border-cyan-400/20",
      hover: "hover:border-cyan-400/30",
    },
    emerald: {
      icon: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20",
      hover: "hover:border-emerald-400/30",
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full flex-col rounded-2xl border border-white/10 bg-[#121b2e]/80 p-6 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-[#172139] ${accents[accent].hover}`}
    >
      <div
        className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border ${accents[accent].icon}`}
      >
        {icon}
      </div>

      <h3 className="text-base font-semibold text-white">
        {title}
      </h3>

      <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">
        {description}
      </p>

      <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-violet-300">
        {action}
        <ArrowRight
          size={15}
          className="transition-transform group-hover:translate-x-1"
        />
      </div>
    </button>
  );
}

function Overview({
  navigate,
  user,
  accessToken,
  onUnauthorized,
}: {
  navigate: (page: Page) => void;
  user: User;
  accessToken: string;
  onUnauthorized: () => void;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/documents", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
          signal,
        });

        if (response.status === 401) {
          onUnauthorized();
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Unable to load dashboard statistics (${response.status}).`
          );
        }

        const payload: unknown = await response.json();
        const documents = normalizeDocuments(payload);

        if (!signal?.aborted) {
          setStats(calculateStats(documents));
        }
      } catch (err) {
        if (signal?.aborted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard statistics."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [accessToken, onUnauthorized]
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadStats(controller.signal);

    return () => controller.abort();
  }, [loadStats]);

  const metrics = [
    {
      label: "Total Documents",
      value: stats?.totalDocuments.toLocaleString() ?? "—",
      icon: Files,
      color: "text-violet-300",
      background: "bg-violet-500/10",
    },
    {
      label: "Indexed Documents",
      value: stats?.indexedDocuments.toLocaleString() ?? "—",
      icon: Database,
      color: "text-cyan-300",
      background: "bg-cyan-500/10",
    },
    {
      label: "Knowledge Words",
      value: stats?.totalWords.toLocaleString() ?? "—",
      icon: BookOpen,
      color: "text-fuchsia-300",
      background: "bg-fuchsia-500/10",
    },
    {
      label: "Storage Used",
      value: stats ? formatBytes(stats.storageBytes) : "—",
      icon: HardDrive,
      color: "text-emerald-300",
      background: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-8">
      {/* Welcome section */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-[#141c32] p-7 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />

        <div className="pointer-events-none absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300">
            <Sparkles size={13} />
            CortexIQ AI
          </div>

          <p className="mb-2 text-sm text-slate-400">
            Welcome to your workspace
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Turn knowledge into intelligence.
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
            Upload documents, build a searchable knowledge base,
            discover relevant evidence, and ask your AI assistant
            questions grounded in your own information.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("assistant")}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              <Sparkles size={16} />
              Open AI Assistant
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => navigate("knowledge")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              <Files size={16} />
              Manage Documents
            </button>
          </div>
        </div>
      </section>

      {/* Live dashboard statistics */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Knowledge Overview
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Live statistics from your document library
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh Stats
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200"
          >
            <AlertCircle size={18} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div
                key={metric.label}
                className="rounded-2xl border border-white/[0.07] bg-[#121b2e]/80 p-5"
              >
                <div
                  className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${metric.background} ${metric.color}`}
                >
                  <Icon size={21} />
                </div>

                <p className="text-xs text-slate-400">
                  {metric.label}
                </p>

                <div className="mt-3 min-h-[36px]">
                  {loading && !stats ? (
                    <LoaderCircle
                      size={22}
                      className="animate-spin text-violet-300"
                    />
                  ) : (
                    <p className="text-2xl font-bold tracking-tight text-white">
                      {metric.value}
                    </p>
                  )}
                </div>

                <p className="mt-2 text-[11px] text-slate-500">
                  {loading
                    ? "Refreshing..."
                    : error
                    ? "Last successfully loaded value"
                    : "From your knowledge base"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Workspace navigation cards */}
      <section>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">
            Explore your workspace
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Your core knowledge intelligence tools
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard
            icon={<BookOpen size={22} />}
            title="Knowledge Base"
            description="Upload, index, inspect, and manage the documents available to your AI system."
            action="Open Knowledge Base"
            accent="violet"
            onClick={() => navigate("knowledge")}
          />

          <FeatureCard
            icon={<Search size={22} />}
            title="Intelligent Search"
            description="Find relevant passages using hybrid and semantic search across your indexed knowledge."
            action="Explore Search"
            accent="cyan"
            onClick={() => navigate("search")}
          />

          <FeatureCard
            icon={<BrainCircuit size={22} />}
            title="AI Assistant"
            description="Ask questions, inspect retrieved sources, and review citation validation alongside generated answers."
            action="Start Conversation"
            accent="emerald"
            onClick={() => navigate("assistant")}
          />
        </div>
      </section>

      {/* Workflow and trust sections */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#121b2e]/80 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-300">
              <Activity size={20} />
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Your intelligence workflow
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                From raw documents to evidence-grounded answers
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              ["01", "Upload", "Add documents to your private library"],
              ["02", "Index", "Prepare documents for retrieval"],
              ["03", "Retrieve", "Find relevant evidence with search"],
              ["04", "Ask", "Generate answers grounded in your sources"],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="flex items-start gap-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-violet-300">
                  {number}
                </span>

                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {title}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121b2e]/80 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-violet-500/10 p-3 text-violet-300">
              <ShieldCheck size={20} />
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Built for trustworthy answers
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                Evidence-first AI experiences
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm leading-6 text-slate-400">
            <p>
              CortexIQ connects retrieval and generation to your
              authenticated knowledge workspace.
            </p>

            <p>
              Retrieved source passages help you inspect the
              evidence behind generated responses.
            </p>

            <p>
              Citation validation gives you an additional signal
              when evaluating whether a response references
              its sources correctly.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("assistant")}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200"
          >
            Try the AI Assistant
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <p className="text-xs text-slate-600">
        Signed in as {user.email}
      </p>
    </div>
  );
}

export default function CortexWorkspace({
  accessToken,
  user,
  onLogout,
}: CortexWorkspaceProps) {
  const [page, setPage] = useState<Page>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setSidebarOpen(false);
  }

  const currentPage =
    navigation.find((item) => item.id === page) ??
    navigation[0];

  return (
    <div className="min-h-screen bg-[#090e1b] text-slate-100">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 top-0 h-[500px] w-[500px] rounded-full bg-violet-900/10 blur-[130px]" />

        <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-cyan-900/10 blur-[120px]" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/10 bg-[#0d1424] transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <button
            type="button"
            onClick={() => navigate("overview")}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-900/20">
              <BrainCircuit
                size={23}
                className="text-white"
              />
            </div>

            <div>
              <p className="text-xl font-bold tracking-tight text-white">
                Cortex
                <span className="text-violet-400">IQ</span>
              </p>

              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                AI
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-7">
          <p className="mb-4 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Workspace
          </p>

          <nav className="space-y-1.5">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  aria-current={
                    active ? "page" : undefined
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                    active
                      ? "border border-violet-400/20 bg-violet-500/15 font-medium text-violet-200"
                      : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  <Icon
                    size={18}
                    className={
                      active
                        ? "text-violet-300"
                        : "text-slate-500"
                    }
                  />

                  <span className="flex-1">
                    {item.label}
                  </span>

                  {active && (
                    <ChevronRight
                      size={15}
                      className="text-violet-400"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-10 px-3">
            <div className="rounded-2xl border border-violet-400/10 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <Sparkles size={18} />
              </div>

              <p className="text-sm font-semibold text-slate-200">
                Knowledge Intelligence
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Search your documents and explore
                AI-powered answers.
              </p>
            </div>
          </div>
        </div>

        {/* User profile */}
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-400/20 bg-violet-500/15 text-sm font-semibold text-violet-200">
              {user.email.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-200">
                My Workspace
              </p>

              <p className="truncate text-[11px] text-slate-500">
                {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main workspace */}
      <div className="relative min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/10 bg-[#0b1120]/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                Workspace
                <ChevronRight size={12} />
                <span className="text-violet-300">
                  {currentPage.label}
                </span>
              </div>

              <h2 className="mt-1 text-base font-semibold text-white">
                {currentPage.label}
              </h2>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-400">
              CortexIQ AI
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/20 bg-violet-500/15 text-xs font-semibold text-violet-200">
              {user.email.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-80px)] p-4 sm:p-6 lg:p-8">
          {page === "knowledge" ? (
            <KnowledgeBase
              accessToken={accessToken}
              onUnauthorized={onLogout}
            />
          ) : page === "search" ? (
            <IntelligentSearch
              accessToken={accessToken}
              onUnauthorized={onLogout}
            />
          ) : page === "assistant" ? (
            <AIAssistant
              accessToken={accessToken}
              onUnauthorized={onLogout}
            />
          ) : (
            <Overview
              navigate={navigate}
              user={user}
              accessToken={accessToken}
              onUnauthorized={onLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
}
