
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { AnimatePresence, motion } from "motion/react";

import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Database,
  FileSearch,
  FileText,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";


type SearchMode = "hybrid" | "semantic";

type SearchResult = {
  id: string;
  documentId: string;
  filename: string;
  text: string;
  score: number | null;
  chunkIndex: number | null;
};

type SearchResponse = {
  results: SearchResult[];
  total: number;
};

type IntelligentSearchProps = {
  accessToken: string;
  onUnauthorized: () => void;
};


const suggestions = [
  "Find technical skills",
  "Find machine learning experience",
  "Find data engineering projects",
  "Find Python and SQL experience",
];

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be",
  "by", "can", "do", "does", "for", "from",
  "has", "have", "in", "is", "it", "me",
  "my", "of", "on", "or", "our", "show",
  "tell", "that", "the", "their", "there",
  "these", "this", "to", "us", "was",
  "were", "what", "which", "who", "with",
  "you", "your", "about", "find", "give",
]);

const PREVIEW_LIMIT = 330;


function asObject(
  value: unknown
): Record<string, unknown> | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}


function firstString(
  object: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    if (typeof object[key] === "string") {
      return object[key] as string;
    }
  }

  return null;
}


function firstNumber(
  object: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const value = object[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return null;
}


function normalizeResult(
  value: unknown,
  index: number
): SearchResult {
  const item = asObject(value);

  if (!item) {
    throw new Error("Search returned an invalid result.");
  }

  const nestedDocument = asObject(item.document);
  const nestedChunk = asObject(item.chunk);

  const text =
    firstString(item, [
      "text",
      "chunk_text",
      "content",
      "passage",
      "snippet",
    ]) ??
    (nestedChunk
      ? firstString(nestedChunk, ["text", "content"])
      : null);

  if (text === null) {
    throw new Error(
      "Search results do not contain a recognized text field."
    );
  }

  const documentId =
    firstString(item, ["document_id", "documentId"]) ??
    (nestedDocument
      ? firstString(nestedDocument, ["id"])
      : null) ??
    "";

  const filename =
    firstString(item, [
      "filename",
      "document_name",
      "document_title",
      "source",
    ]) ??
    (nestedDocument
      ? firstString(nestedDocument, [
          "filename",
          "name",
          "title",
        ])
      : null) ??
    "Document source";

  const chunkIndex =
    firstNumber(item, ["chunk_index", "chunkIndex"]) ??
    (nestedChunk
      ? firstNumber(nestedChunk, [
          "chunk_index",
          "index",
        ])
      : null);

  return {
    id: String(
      item.chunk_id ??
      item.id ??
      `${documentId}-${chunkIndex ?? index}`
    ),
    documentId,
    filename,
    text,
    score: firstNumber(item, [
      "score",
      "similarity",
      "similarity_score",
      "hybrid_score",
      "rrf_score",
      "relevance_score",
    ]),
    chunkIndex,
  };
}


function normalizeResponse(
  payload: unknown
): SearchResponse {
  let items: unknown = payload;
  let total: number | null = null;

  if (!Array.isArray(payload)) {
    const object = asObject(payload);

    if (!object) {
      throw new Error(
        "The search API returned an unexpected response."
      );
    }

    items =
      object.results ??
      object.matches ??
      object.chunks ??
      object.items;

    total = firstNumber(object, [
      "total",
      "total_results",
      "count",
    ]);
  }

  if (!Array.isArray(items)) {
    throw new Error(
      "The search API response does not contain a results array."
    );
  }

  const results = items.map(normalizeResult);

  return {
    results,
    total: total ?? results.length,
  };
}


function getErrorMessage(
  payload: unknown,
  fallback: string
): string {
  const object = asObject(payload);
  const detail = object?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => asObject(item)?.msg)
      .filter(
        (item): item is string =>
          typeof item === "string"
      );

    if (messages.length > 0) {
      return messages.join(". ");
    }
  }

  return fallback;
}


function formatScore(score: number | null): string {
  return score === null
    ? "N/A"
    : score.toFixed(4);
}


/*
 * Extract meaningful search terms.
 * These terms are used only for preview selection.
 * They do not replace backend semantic retrieval.
 */

function getSearchTerms(query: string): string[] {
  const matches: string[] =
    query.toLowerCase().match(/[a-z0-9+#.]+/g) ?? [];

  const words: string[] = matches.filter(
    (word: string): boolean => {
      return (
        word.length > 1 &&
        !STOP_WORDS.has(word)
      );
    }
  );

  return Array.from(new Set<string>(words));
}



/*
 * Select a short excerpt from the original passage.
 *
 * This is extractive, not generative:
 * every displayed word comes from the source text.
 *
 * It is a presentation improvement, not a
 * substitute for backend relevance evaluation.
 */
function getFocusedPreview(
  text: string,
  query: string
): string {
  const cleaned = text
    .replace(/\r/g, "")
    .trim();

  if (cleaned.length <= PREVIEW_LIMIT) {
    return cleaned;
  }

  const terms = getSearchTerms(query);

  if (terms.length === 0) {
    return (
      cleaned.slice(0, PREVIEW_LIMIT).trimEnd() +
      "…"
    );
  }

  const lowerText = cleaned.toLowerCase();

  let bestPosition = 0;
  let bestScore = -1;

  // Examine windows around query-term occurrences.
  const positions = new Set<number>([0]);

  for (const term of terms) {
    let position = lowerText.indexOf(term);
    let occurrences = 0;

    while (
      position !== -1 &&
      occurrences < 30
    ) {
      positions.add(position);

      position = lowerText.indexOf(
        term,
        position + term.length
      );

      occurrences += 1;
    }
  }

  for (const position of positions) {
    const start = Math.max(
      0,
      position - 75
    );

    const windowText = lowerText.slice(
      start,
      start + PREVIEW_LIMIT
    );

    let score = 0;

    for (const term of terms) {
      if (windowText.includes(term)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestPosition = start;
    }
  }

  // Prefer readable word boundaries.
  let start = bestPosition;

  if (start > 0) {
    const nextSpace = cleaned.indexOf(
      " ",
      start
    );

    if (
      nextSpace !== -1 &&
      nextSpace - start < 30
    ) {
      start = nextSpace + 1;
    }
  }

  let end = Math.min(
    cleaned.length,
    start + PREVIEW_LIMIT
  );

  if (end < cleaned.length) {
    const lastSpace = cleaned.lastIndexOf(
      " ",
      end
    );

    if (lastSpace > start + 150) {
      end = lastSpace;
    }
  }

  const excerpt = cleaned
    .slice(start, end)
    .trim();

  return (
    (start > 0 ? "…" : "") +
    excerpt +
    (end < cleaned.length ? "…" : "")
  );
}


export default function IntelligentSearch({
  accessToken,
  onUnauthorized,
}: IntelligentSearchProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] =
    useState<SearchMode>("hybrid");

  const [topK, setTopK] = useState(3);

  const [results, setResults] =
    useState<SearchResult[]>([]);

  const [total, setTotal] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [hasSearched, setHasSearched] =
    useState(false);

  const [lastQuery, setLastQuery] =
    useState("");

  const [lastMode, setLastMode] =
    useState<SearchMode>("hybrid");

  const [duration, setDuration] =
    useState<number | null>(null);

  const [copiedId, setCopiedId] =
    useState<string | null>(null);

  const [showSettings, setShowSettings] =
    useState(false);

  const [expandedIds, setExpandedIds] =
    useState<string[]>([]);

  const requestController =
    useRef<AbortController | null>(null);

  const requestNumber = useRef(0);


  useEffect(() => {
    return () => {
      requestController.current?.abort();
    };
  }, []);


  async function performSearch(
    searchQuery: string,
    searchMode: SearchMode = mode
  ) {
    const cleanedQuery = searchQuery.trim();

    if (!cleanedQuery) {
      setError(
        "Enter a question or search phrase to begin."
      );
      return;
    }

    requestController.current?.abort();

    const controller = new AbortController();

    requestController.current = controller;

    const currentRequest =
      ++requestNumber.current;

    const startedAt = performance.now();

    setLoading(true);
    setError("");
    setResults([]);
    setTotal(null);
    setDuration(null);
    setExpandedIds([]);
    setCopiedId(null);
    setHasSearched(true);
    setLastQuery(cleanedQuery);
    setLastMode(searchMode);

    try {
      const endpoint =
        searchMode === "hybrid"
          ? "/api/search/hybrid"
          : "/api/search/semantic";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: cleanedQuery,
          top_k: topK,
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (
        currentRequest !== requestNumber.current
      ) {
        return;
      }

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const payload: unknown = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            payload,
            `Search failed with HTTP ${response.status}.`
          )
        );
      }

      const normalized =
        normalizeResponse(payload);

      if (
        currentRequest !== requestNumber.current
      ) {
        return;
      }

      setResults(normalized.results);
      setTotal(normalized.total);

      setDuration(
        Math.round(
          performance.now() - startedAt
        )
      );
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }

      if (
        currentRequest === requestNumber.current
      ) {
        setError(
          err instanceof Error
            ? err.message
            : "Search could not be completed."
        );
      }
    } finally {
      if (
        currentRequest === requestNumber.current
      ) {
        setLoading(false);
      }
    }
  }


  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    void performSearch(query);
  }


  async function copyPassage(
    result: SearchResult
  ) {
    try {
      await navigator.clipboard.writeText(
        result.text
      );

      setCopiedId(result.id);
    } catch {
      setError(
        "Unable to copy the passage to your clipboard."
      );
    }
  }


  function toggleExpanded(id: string) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );
  }


  function clearSearch() {
    requestController.current?.abort();

    requestNumber.current += 1;

    setQuery("");
    setResults([]);
    setTotal(null);
    setDuration(null);
    setError("");
    setLoading(false);
    setHasSearched(false);
    setExpandedIds([]);
    setCopiedId(null);
  }


  return (
    <div className="space-y-8 pb-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
      >
        <div>
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-violet-300">
            <Sparkles size={14} />
            CORTEXIQ RETRIEVAL ENGINE
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Intelligent{" "}
            <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              Search.
            </span>
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
            Find relevant evidence across your private
            knowledge library. Expand any result to
            inspect its complete source passage.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/15 bg-emerald-400/5 px-4 py-2 text-[11px] text-emerald-300">
          <ShieldCheck size={15} />
          Authenticated retrieval
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="relative overflow-hidden rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-[#191632] via-[#12172d] to-[#0c1930] p-6 sm:p-9"
      >
        <div className="pointer-events-none absolute -right-24 -top-32 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[110px]" />

        <div className="relative">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-400/10 text-violet-200">
              <BrainCircuit size={26} />
            </div>

            <div>
              <h3 className="text-base font-semibold">
                Explore your knowledge
              </h3>

              <p className="mt-1 text-[11px] text-slate-400">
                Find evidence with hybrid or semantic retrieval
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("hybrid")}
              aria-pressed={mode === "hybrid"}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
                mode === "hybrid"
                  ? "border-violet-400/40 bg-violet-500/20 text-violet-100"
                  : "border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/10"
              }`}
            >
              <WandSparkles size={16} />
              Hybrid Search
              {mode === "hybrid" && (
                <Check size={13} />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMode("semantic")}
              aria-pressed={mode === "semantic"}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
                mode === "semantic"
                  ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                  : "border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/10"
              }`}
            >
              <BrainCircuit size={16} />
              Semantic Search
              {mode === "semantic" && (
                <Check size={13} />
              )}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex items-start gap-3 rounded-2xl border border-violet-400/25 bg-[#0b1020]/80 p-3 transition focus-within:border-violet-300/60">
              <Search
                size={22}
                className="ml-2 mt-2 shrink-0 text-violet-300"
              />

              <textarea
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();

                    if (!loading) {
                      void performSearch(query);
                    }
                  }
                }}
                rows={2}
                maxLength={1000}
                placeholder="Search skills, projects, technologies, or document content..."
                aria-label="Search your knowledge"
                className="min-h-[75px] flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-7 text-white outline-none placeholder:text-slate-600"
              />

              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={clearSearch}
                  className="mt-2 text-slate-500 hover:text-white"
                >
                  <X size={17} />
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={() =>
                  setShowSettings(!showSettings)
                }
                aria-expanded={showSettings}
                className="flex items-center gap-2 text-xs text-slate-400 transition hover:text-white"
              >
                <SlidersHorizontal size={16} />
                Search Settings

                <ChevronDown
                  size={14}
                  className={`transition-transform ${
                    showSettings
                      ? "rotate-180"
                      : ""
                  }`}
                />
              </button>

              <button
                type="submit"
                disabled={
                  loading || !query.trim()
                }
                className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-xs font-semibold shadow-[0_10px_30px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
              >
                {loading ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Search size={17} />
                )}

                {loading
                  ? "Searching..."
                  : "Search Knowledge"}

                {!loading && (
                  <ArrowRight size={16} />
                )}
              </button>
            </div>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{
                    opacity: 0,
                    height: 0,
                  }}
                  animate={{
                    opacity: 1,
                    height: "auto",
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                  }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.035] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold">
                          Maximum results
                        </p>

                        <p className="mt-1 text-[11px] text-slate-500">
                          Number of source passages to retrieve
                        </p>
                      </div>

                      <select
                        value={topK}
                        onChange={(event) =>
                          setTopK(
                            Number(
                              event.target.value
                            )
                          )
                        }
                        className="rounded-lg border border-white/10 bg-[#12172b] px-4 py-2 text-xs text-white outline-none"
                      >
                        {[3, 5, 10, 15, 20].map(
                          (value) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {value} results
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="mt-7">
            <p className="mb-3 text-[10px] font-bold tracking-[0.12em] text-slate-500">
              EXPLORE IDEAS
            </p>

            <div className="flex flex-wrap gap-2">
              {suggestions.map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setQuery(suggestion);
                      void performSearch(
                        suggestion
                      );
                    }}
                    disabled={loading}
                    className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-[11px] text-slate-400 transition hover:border-violet-400/30 hover:bg-violet-400/10 hover:text-violet-200 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-xs leading-6 text-red-200"
        >
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <p className="flex-1">
            {error}
          </p>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-white/[0.07] bg-white/[0.025] px-6 text-center"
          >
            <LoaderCircle
              size={42}
              className="mb-5 animate-spin text-violet-300"
            />

            <h3 className="text-sm font-semibold">
              Searching your knowledge...
            </h3>

            <p className="mt-3 text-xs text-slate-500">
              Retrieving relevant document passages
            </p>
          </motion.div>
        ) : hasSearched &&
          results.length > 0 ? (
          <motion.section
            key="results"
            initial={{
              opacity: 0,
              y: 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">
                  Search Results
                </h3>

                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {total ?? results.length} result
                  {(total ?? results.length) === 1
                    ? ""
                    : "s"}{" "}
                  for "{lastQuery}"
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-[10px] font-semibold text-violet-200">
                  {lastMode === "hybrid"
                    ? "HYBRID RETRIEVAL"
                    : "SEMANTIC RETRIEVAL"}
                </span>

                {duration !== null && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[10px] text-slate-400">
                    <Clock3 size={13} />
                    {duration} ms
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs leading-6 text-slate-400">
              Showing focused excerpts from
              retrieved documents. Expand a
              result to inspect the complete
              original passage.
            </p>

            <div className="space-y-4">
              {results.map(
                (result, index) => {
                  const expanded =
                    expandedIds.includes(
                      result.id
                    );

                  const preview =
                    getFocusedPreview(
                      result.text,
                      lastQuery
                    );

                  const canExpand =
                    preview !==
                    result.text.trim();

                  return (
                    <motion.article
                      key={`${result.id}-${index}`}
                      initial={{
                        opacity: 0,
                        y: 12,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay: Math.min(
                          index * 0.04,
                          0.3
                        ),
                      }}
                      className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-violet-400/[0.02] p-5 sm:p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-400/10 text-violet-300">
                            <FileText
                              size={21}
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="mb-1 text-[10px] font-bold tracking-wider text-violet-300">
                              RESULT{" "}
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </p>

                            <h4 className="break-all text-sm font-semibold text-slate-200">
                              {result.filename}
                            </h4>

                            <p className="mt-1 text-[11px] text-slate-500">
                              {result.chunkIndex !==
                              null
                                ? `Chunk ${
                                    result.chunkIndex +
                                    1
                                  }`
                                : "Document passage"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-3 py-2 text-right">
                            <p className="text-[9px] font-semibold tracking-wider text-slate-500">
                              RETRIEVAL SCORE
                            </p>

                            <p className="mt-1 text-sm font-bold text-cyan-300">
                              {formatScore(
                                result.score
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              void copyPassage(
                                result
                              )
                            }
                            title="Copy full passage"
                            aria-label={`Copy result ${
                              index + 1
                            }`}
                            className="rounded-xl border border-white/10 p-3 text-slate-400 transition hover:bg-white/10 hover:text-white"
                          >
                            {copiedId ===
                            result.id ? (
                              <Check
                                size={17}
                              />
                            ) : (
                              <Copy
                                size={17}
                              />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#0b1020]/65 p-5">
                        <p className="whitespace-pre-wrap break-words text-[13px] leading-7 text-slate-300">
                          {expanded
                            ? result.text
                            : preview}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <ShieldCheck
                            size={14}
                            className="text-violet-300"
                          />

                          Retrieved document evidence
                        </div>

                        {canExpand && (
                          <button
                            type="button"
                            onClick={() =>
                              toggleExpanded(
                                result.id
                              )
                            }
                            aria-expanded={
                              expanded
                            }
                            className="flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-400/20"
                          >
                            {expanded ? (
                              <>
                                Show Less
                                <ChevronUp
                                  size={15}
                                />
                              </>
                            ) : (
                              <>
                                View Full Passage
                                <ChevronDown
                                  size={15}
                                />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </motion.article>
                  );
                }
              )}
            </div>

            <p className="px-2 text-[11px] leading-6 text-slate-500">
              Results retain backend ranking.
              Previews are selected from the
              original document text. Retrieval
              scores are not confidence
              percentages.
            </p>
          </motion.section>
        ) : hasSearched && !error ? (
          <motion.div
            key="empty"
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-white/[0.07] bg-white/[0.025] px-6 text-center"
          >
            <FileSearch
              size={34}
              className="mb-5 text-violet-300"
            />

            <h3 className="text-sm font-semibold">
              No matching passages found
            </h3>

            <p className="mt-3 max-w-md text-xs leading-6 text-slate-500">
              Try another phrase, switch
              retrieval modes, or index more
              documents in your Knowledge Base.
            </p>
          </motion.div>
        ) : !hasSearched ? (
          <motion.div
            key="initial"
            initial={{
              opacity: 0,
              y: 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-white/[0.07] bg-gradient-to-br from-white/[0.035] to-violet-400/[0.025] px-6 text-center"
          >
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-400/20 bg-violet-400/10 text-violet-300">
              <Database
                size={37}
                strokeWidth={1.3}
              />
            </div>

            <h3 className="text-lg font-semibold">
              Your knowledge is ready to explore
            </h3>

            <p className="mt-3 max-w-md text-xs leading-7 text-slate-500">
              Search indexed documents to find
              relevant evidence and inspect
              original source passages.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
