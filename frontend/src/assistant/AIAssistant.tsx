
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

type ChatSource = {
  citation: string;
  document_id: string;
  filename: string;
  chunk_id: number;
  text: string;
};

type CitationValidation = {
  has_citations: boolean;
  references_valid: boolean;
  valid_citations: string[];
  invalid_citations: string[];
  unused_citations: string[];
  citation_count: number;
  validation_type: string;
};

type ChatResponse = {
  question: string;
  answer: string;
  sources: ChatSource[];
  model: string;
  citation_validation: CitationValidation;
  evidence_verification?: unknown | null;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type StoredMessage = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  metadata_json: string | null;
  created_at: string;
};

type ConversationDetail = Conversation & {
  messages: StoredMessage[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
  error?: boolean;
};

type Props = {
  accessToken: string;
  onUnauthorized: () => void;
};

const suggestions = [
  "Summarize the key findings in my documents",
  "What technologies and tools are mentioned?",
  "Compare the main ideas across my documents",
  "What important information is missing?",
];

function readSavedResponse(
  metadata: string | null,
): ChatResponse | undefined {
  if (!metadata) return undefined;

  try {
    const data: unknown = JSON.parse(metadata);

    if (
      typeof data === "object" &&
      data !== null &&
      "answer" in data &&
      typeof data.answer === "string" &&
      "sources" in data &&
      Array.isArray(data.sources) &&
      "citation_validation" in data
    ) {
      return data as ChatResponse;
    }
  } catch {
    // Older messages may not contain valid metadata.
  }

  return undefined;
}

function CitationStatus({
  validation,
}: {
  validation: CitationValidation;
}) {
  if (!validation.has_citations) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-400/20 bg-slate-400/10 px-3 py-1.5 text-xs text-slate-300">
        <BookOpen size={13} />
        No citations in answer
      </span>
    );
  }

  if (
    validation.references_valid &&
    validation.invalid_citations.length === 0
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
        <ShieldCheck size={13} />
        Citations validated
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-300">
      <ShieldAlert size={13} />
      Citation validation warning
    </span>
  );
}

function SourceCard({ source }: { source: ChatSource }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-white/[0.04]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
            <FileText size={17} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">
              {source.filename}
            </p>
            <p className="text-xs text-slate-500">
              {source.citation} · Chunk {source.chunk_id}
            </p>
          </div>
        </div>

        {expanded ? (
          <ChevronUp size={16} className="shrink-0 text-slate-400" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 py-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
            {source.text}
          </p>
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-violet-400/20 bg-violet-500/15 px-4 py-3 text-sm leading-7 text-slate-100">
          <p className="whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  const response = message.response;
  const validation = response?.citation_validation;

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/15 text-violet-300">
        <Sparkles size={17} />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-100">
            CortexIQ
          </span>

          {response?.model && (
            <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-400">
              {response.model}
            </span>
          )}
        </div>

        {message.error ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">
            <AlertCircle size={16} className="mt-1 shrink-0" />
            <p>{message.content}</p>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">
            {message.content}
          </div>
        )}

        {validation && (
          <div className="flex flex-wrap items-center gap-2">
            <CitationStatus validation={validation} />

            <span className="text-xs text-slate-500">
              {validation.citation_count} citation(s)
            </span>

            {response?.evidence_verification != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-300">
                <CheckCircle2 size={13} />
                Evidence check returned
              </span>
            )}
          </div>
        )}

        {response && response.sources.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-violet-300" />
              <h3 className="text-sm font-semibold text-slate-200">
                Retrieved Sources ({response.sources.length})
              </h3>
            </div>

            <div className="space-y-2">
              {response.sources.map((source, index) => (
                <SourceCard
                  key={`${source.document_id}-${source.chunk_id}-${index}`}
                  source={source}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIAssistant({
  accessToken,
  onUnauthorized,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);
  const [error, setError] = useState("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [topK, setTopK] = useState(3);
  const [verifyEvidence, setVerifyEvidence] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const activeIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  function setCurrentConversation(id: string | null) {
    activeIdRef.current = id;
    setActiveId(id);
  }

  function cancelActiveRequest() {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    loadingRef.current = false;
    setLoading(false);
  }

  async function api<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);

    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`/api${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      onUnauthorized();
      throw new Error("Your session has expired. Please sign in again.");
    }

    if (!response.ok) {
      let detail = `Request failed with status ${response.status}.`;

      try {
        const data: unknown = await response.json();

        if (
          typeof data === "object" &&
          data !== null &&
          "detail" in data &&
          typeof data.detail === "string"
        ) {
          detail = data.detail;
        }
      } catch {
        // Use the HTTP error message.
      }

      throw new Error(detail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async function refreshHistory() {
    const data = await api<Conversation[]>("/chat/conversations");
    setConversations(data);
    return data;
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const response = await fetch("/api/chat/conversations", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!mounted) return;

        if (response.status === 401) {
          onUnauthorized();
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Unable to load conversations (${response.status}).`,
          );
        }

        const data = (await response.json()) as Conversation[];

        if (mounted) {
          setConversations(data);
        }
      } catch (cause) {
        if (mounted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load chat history.",
          );
        }
      } finally {
        if (mounted) {
          setHistoryLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      mounted = false;
      requestIdRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [accessToken, onUnauthorized]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  function newChat() {
    cancelActiveRequest();
    setCurrentConversation(null);
    setMessages([]);
    setQuestion("");
    setOpeningChat(false);
    setError("");
  }

  async function openConversation(id: string) {
    if (loadingRef.current || openingChat) return;

    cancelActiveRequest();
    const requestId = requestIdRef.current;

    setOpeningChat(true);
    setError("");

    try {
      const data = await api<ConversationDetail>(
        `/chat/conversations/${encodeURIComponent(id)}`,
      );

      if (requestId !== requestIdRef.current) return;

      const restored: Message[] = data.messages
        .filter(
          (message) =>
            message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          id: message.id,
          role: message.role as "user" | "assistant",
          content: message.content,
          response:
            message.role === "assistant"
              ? readSavedResponse(message.metadata_json)
              : undefined,
        }));

      setCurrentConversation(id);
      setMessages(restored);
      setQuestion("");
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to open conversation.",
        );
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setOpeningChat(false);
      }
    }
  }

  async function deleteConversation(id: string) {
    if (loadingRef.current || openingChat) return;

    if (!window.confirm("Delete this conversation permanently?")) {
      return;
    }

    setError("");

    try {
      await api<void>(
        `/chat/conversations/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      setConversations((previous) =>
        previous.filter((conversation) => conversation.id !== id),
      );

      if (activeIdRef.current === id) {
        newChat();
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to delete conversation.",
      );
    }
  }

  async function sendQuestion(value?: string) {
    const text = (value ?? question).trim();

    if (
      !text ||
      text.length > 2000 ||
      loadingRef.current ||
      openingChat
    ) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    controllerRef.current = controller;
    loadingRef.current = true;
    setLoading(true);
    setQuestion("");
    setError("");

    const userMessage: Message = {
      id: `pending-user-${requestId}`,
      role: "user",
      content: text,
    };

    setMessages((previous) => [...previous, userMessage]);

    let conversationId = activeIdRef.current;

    try {
      if (!conversationId) {
        const created = await api<Conversation>(
          "/chat/conversations",
          {
            method: "POST",
            body: JSON.stringify({
              title:
                text.length > 70
                  ? `${text.slice(0, 67)}...`
                  : text,
            }),
            signal: controller.signal,
          },
        );

        if (requestId !== requestIdRef.current) return;

        conversationId = created.id;
        setCurrentConversation(created.id);

        setConversations((previous) => [
          created,
          ...previous.filter((item) => item.id !== created.id),
        ]);
      }

      const result = await api<ChatResponse>(
        `/chat/conversations/${encodeURIComponent(conversationId)}/ask`,
        {
          method: "POST",
          body: JSON.stringify({
            question: text,
            top_k: topK,
            verify_evidence: verifyEvidence,
          }),
          signal: controller.signal,
        },
      );

      if (requestId !== requestIdRef.current) return;

      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${requestId}`,
          role: "assistant",
          content: result.answer,
          response: result,
        },
      ]);

      try {
        await refreshHistory();
      } catch {
        // Answer is already saved; history refresh can be retried.
      }
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;

      if (cause instanceof Error && cause.name === "AbortError") {
        return;
      }

      setMessages((previous) => [
        ...previous,
        {
          id: `error-${requestId}`,
          role: "assistant",
          content:
            cause instanceof Error
              ? cause.message
              : "Something went wrong while generating the answer.",
          error: true,
        },
      ]);
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
        controllerRef.current = null;
      }
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-150px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1020] text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/15 text-violet-300">
            <Sparkles size={21} />
          </div>

          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              AI Assistant
            </h2>
            <p className="text-xs text-slate-400">
              Ask questions grounded in your knowledge base
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.08]"
          >
            <Settings2 size={16} />
            Settings
          </button>

          <button
            type="button"
            onClick={newChat}
            disabled={loading || openingChat}
            className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/15 px-3 py-2 text-sm text-violet-200 transition hover:bg-violet-500/25 disabled:opacity-40"
          >
            <MessageSquarePlus size={16} />
            New Chat
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="space-y-4 border-b border-white/10 bg-white/[0.02] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">
                Retrieved passages
              </p>
              <p className="text-xs text-slate-500">
                Maximum number of passages sent to the AI
              </p>
            </div>

            <select
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
              className="rounded-lg border border-white/10 bg-[#171b30] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/50"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} passages
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-200">
                Request evidence verification
              </p>
              <p className="text-xs text-slate-500">
                Ask the backend to check supporting evidence
              </p>
            </div>

            <input
              type="checkbox"
              checked={verifyEvidence}
              onChange={(event) =>
                setVerifyEvidence(event.target.checked)
              }
              className="h-4 w-4 accent-violet-500"
            />
          </label>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 border-b border-rose-400/20 bg-rose-400/10 px-5 py-3 text-sm text-rose-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex min-h-[460px] flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-white/10 bg-white/[0.02] md:w-64 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <History size={16} className="text-violet-300" />
              Chat History
            </div>

            <button
              type="button"
              onClick={() => {
                void refreshHistory().catch((cause: unknown) => {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Unable to refresh history.",
                  );
                });
              }}
              className="text-xs text-violet-300 hover:text-violet-200"
            >
              Refresh
            </button>
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto p-2 md:max-h-[580px]">
            {historyLoading && (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                Loading history...
              </div>
            )}

            {!historyLoading && conversations.length === 0 && (
              <p className="px-3 py-5 text-xs leading-6 text-slate-500">
                No saved conversations yet. Ask a question to create one.
              </p>
            )}

            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group flex items-center gap-1 rounded-xl border ${
                  activeId === conversation.id
                    ? "border-violet-400/25 bg-violet-500/15"
                    : "border-transparent hover:bg-white/[0.05]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void openConversation(conversation.id)}
                  disabled={loading || openingChat}
                  className="min-w-0 flex-1 px-3 py-3 text-left disabled:opacity-50"
                >
                  <p className="truncate text-sm text-slate-200">
                    {conversation.title}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {new Date(
                      conversation.updated_at,
                    ).toLocaleDateString()}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void deleteConversation(conversation.id)
                  }
                  disabled={loading || openingChat}
                  aria-label={`Delete ${conversation.title}`}
                  title="Delete conversation"
                  className="mr-2 rounded-lg p-2 text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="max-h-[620px] min-h-[380px] flex-1 overflow-y-auto px-5 py-6">
            <div className="mx-auto max-w-4xl space-y-7">
              {openingChat && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                  <Loader2 size={18} className="animate-spin" />
                  Opening conversation...
                </div>
              )}

              {!openingChat && messages.length === 0 && (
                <div className="flex min-h-[340px] flex-col items-center justify-center px-3 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/15 text-violet-300">
                    <Sparkles size={30} />
                  </div>

                  <h3 className="text-2xl font-semibold tracking-tight text-white">
                    Explore your knowledge with AI
                  </h3>

                  <p className="mt-3 max-w-lg text-sm leading-7 text-slate-400">
                    Ask questions about your uploaded and indexed documents.
                    CortexIQ retrieves relevant passages and generates answers
                    with source references.
                  </p>

                  <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void sendQuestion(suggestion)}
                        disabled={loading || openingChat}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm leading-6 text-slate-300 transition hover:border-violet-400/30 hover:bg-violet-500/[0.07] disabled:opacity-50"
                      >
                        <div className="mb-2 text-violet-300">
                          <Sparkles size={15} />
                        </div>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!openingChat &&
                messages.map((message) => (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                  />
                ))}

              {loading && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/15 text-violet-300">
                    <Sparkles size={17} />
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                    <Loader2
                      size={16}
                      className="animate-spin text-violet-300"
                    />
                    CortexIQ is analyzing your documents...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#0d1020] px-5 py-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendQuestion();
              }}
              className="mx-auto max-w-4xl"
            >
              <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-colors focus-within:border-violet-400/40">
                <textarea
                  value={question}
                  onChange={(event) =>
                    setQuestion(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();

                      if (!loading && !openingChat) {
                        void sendQuestion();
                      }
                    }
                  }}
                  placeholder="Ask anything about your documents..."
                  rows={2}
                  maxLength={2000}
                  disabled={loading || openingChat}
                  className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={!question.trim() || loading || openingChat}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send question"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowUp size={19} />
                  )}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-xs text-slate-500">
                  Conversations are saved to your account.
                  Verify important answers against the sources.
                </p>

                <span className="text-xs text-slate-500">
                  {question.length}/2000
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
