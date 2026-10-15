
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Database,
  File,
  FileSearch,
  FileText,
  FolderOpen,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

type DocumentRecord = {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  word_count: number;
  status: string;
  created_at: string;
};

type ChunkRecord = {
  id: number;
  chunk_index: number;
  text: string;
  word_count: number;
};

type KnowledgeBaseProps = {
  accessToken: string;
  onUnauthorized: () => void;
};

type Notice = {
  type: "success" | "error";
  message: string;
};

function isIndexed(status: string): boolean {
  return ["processed", "indexed", "completed"].includes(
    status.trim().toLowerCase()
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(value: string): string {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toUpperCase() || "FILE";
}

function normalizeDocuments(payload: unknown): DocumentRecord[] {
  let items: unknown = payload;

  if (!Array.isArray(items) && typeof payload === "object" && payload) {
    const object = payload as Record<string, unknown>;
    items = object.documents ?? object.items ?? object.results;
  }

  if (!Array.isArray(items)) {
    throw new Error("Unexpected document list response from the API.");
  }

  return items.map((value) => {
    if (typeof value !== "object" || value === null) {
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
      file_type:
        typeof item.file_type === "string"
          ? item.file_type
          : getFileExtension(item.filename).toLowerCase(),
      size_bytes: Number(item.size_bytes) || 0,
      word_count: Number(item.word_count) || 0,
      status:
        typeof item.status === "string"
          ? item.status
          : "unknown",
      created_at:
        typeof item.created_at === "string"
          ? item.created_at
          : "",
    };
  });
}

function normalizeChunks(payload: unknown): ChunkRecord[] {
  let items: unknown = payload;

  if (!Array.isArray(items) && typeof payload === "object" && payload) {
    const object = payload as Record<string, unknown>;
    items = object.chunks ?? object.items ?? object.results;
  }

  if (!Array.isArray(items)) {
    throw new Error("Unexpected chunk response from the API.");
  }

  return items.map((value, index) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid document chunk.");
    }

    const item = value as Record<string, unknown>;

    return {
      id: Number(item.id) || index,
      chunk_index: Number(item.chunk_index) || index,
      text: typeof item.text === "string" ? item.text : "",
      word_count: Number(item.word_count) || 0,
    };
  });
}

function getApiError(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null) {
    const detail = (payload as Record<string, unknown>).detail;

    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          typeof item?.msg === "string" ? item.msg : null
        )
        .filter(Boolean);

      if (messages.length > 0) return messages.join(". ");
    }
  }

  return fallback;
}

export default function KnowledgeBase({
  accessToken,
  onUnauthorized,
}: KnowledgeBaseProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentRecord | null>(null);
  const [chunks, setChunks] = useState<ChunkRecord[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState("");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef(false);
  const detailsRequestRef = useRef(0);

  const apiRequest = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const response = await fetch(`/api${path}`, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (response.status === 401) {
        onUnauthorized();
        throw new Error("Your session has expired. Please sign in again.");
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          getApiError(payload, `Request failed (${response.status}).`)
        );
      }

      if (response.status === 204) return null;

      const contentType = response.headers.get("content-type") || "";
      return contentType.includes("application/json")
        ? response.json()
        : null;
    },
    [accessToken, onUnauthorized]
  );

  const loadDocuments = useCallback(async () => {
    setLoading(true);

    try {
      const payload = await apiRequest("/documents");
      setDocuments(normalizeDocuments(payload));
      setLoadedOnce(true);
      return true;
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load documents.",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const closeDocument = () => {
    detailsRequestRef.current += 1;
    setSelectedDocument(null);
    setChunks([]);
    setChunksError("");
    setChunksLoading(false);
  };

  const uploadFile = async (file: File) => {
    if (operationRef.current) return;

    const extension = getFileExtension(file.name).toLowerCase();

    if (!["pdf", "docx", "txt"].includes(extension)) {
      setNotice({
        type: "error",
        message: "Only PDF, DOCX, and TXT files are supported.",
      });
      return;
    }

    if (file.size === 0) {
      setNotice({
        type: "error",
        message: "The selected file is empty.",
      });
      return;
    }

    operationRef.current = true;
    setUploading(true);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      await apiRequest("/documents/upload", {
        method: "POST",
        body: formData,
      });

      const refreshed = await loadDocuments();

      if (refreshed) {
        setNotice({
          type: "success",
          message: `${file.name} uploaded successfully.`,
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Upload failed.",
      });
    } finally {
      operationRef.current = false;
      setUploading(false);

      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const indexDocument = async (document: DocumentRecord) => {
    if (operationRef.current) return;

    operationRef.current = true;
    setIndexingId(document.id);
    setNotice(null);

    try {
      await apiRequest(
        `/documents/${encodeURIComponent(document.id)}/index`,
        { method: "POST" }
      );

      const refreshed = await loadDocuments();

      if (refreshed) {
        setNotice({
          type: "success",
          message: `${document.filename} indexing request completed.`,
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Indexing failed.",
      });
    } finally {
      operationRef.current = false;
      setIndexingId(null);
    }
  };

  const deleteDocument = async (document: DocumentRecord) => {
    if (operationRef.current) return;

    const confirmed = window.confirm(
      `Permanently delete "${document.filename}" and its indexed chunks?`
    );

    if (!confirmed) return;

    operationRef.current = true;
    setDeletingId(document.id);
    setNotice(null);

    try {
      await apiRequest(
        `/documents/${encodeURIComponent(document.id)}`,
        { method: "DELETE" }
      );

      if (selectedDocument?.id === document.id) {
        closeDocument();
      }

      const refreshed = await loadDocuments();

      if (refreshed) {
        setNotice({
          type: "success",
          message: `${document.filename} deleted successfully.`,
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Deletion failed.",
      });
    } finally {
      operationRef.current = false;
      setDeletingId(null);
    }
  };

  const openDocument = async (document: DocumentRecord) => {
    const requestId = ++detailsRequestRef.current;

    setSelectedDocument(document);
    setChunks([]);
    setChunksError("");
    setChunksLoading(true);

    try {
      const payload = await apiRequest(
        `/documents/${encodeURIComponent(document.id)}/chunks`
      );

      if (requestId !== detailsRequestRef.current) return;

      setChunks(normalizeChunks(payload));
    } catch (error) {
      if (requestId !== detailsRequestRef.current) return;

      setChunksError(
        error instanceof Error
          ? error.message
          : "Unable to load document chunks."
      );
    } finally {
      if (requestId === detailsRequestRef.current) {
        setChunksLoading(false);
      }
    }
  };

  const busy = uploading || indexingId !== null || deletingId !== null;

  const filteredDocuments = documents.filter((document) =>
    document.filename.toLowerCase().includes(query.trim().toLowerCase())
  );

  const indexedDocuments = documents.filter((document) =>
    isIndexed(document.status)
  ).length;

  const totalWords = documents.reduce(
    (sum, document) => sum + document.word_count,
    0
  );

  const totalSize = documents.reduce(
    (sum, document) => sum + document.size_bytes,
    0
  );

  const metrics = [
    {
      label: "Total Documents",
      value: documents.length.toLocaleString(),
      icon: FileText,
      color: "text-violet-300",
      background: "bg-violet-400/10",
    },
    {
      label: "Indexed Documents",
      value: indexedDocuments.toLocaleString(),
      icon: BrainCircuit,
      color: "text-cyan-300",
      background: "bg-cyan-400/10",
    },
    {
      label: "Knowledge Words",
      value: totalWords.toLocaleString(),
      icon: Layers3,
      color: "text-fuchsia-300",
      background: "bg-fuchsia-400/10",
    },
    {
      label: "Storage Used",
      value: formatBytes(totalSize),
      icon: Database,
      color: "text-emerald-300",
      background: "bg-emerald-400/10",
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
      >
        <div>
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-violet-300">
            <Sparkles size={14} />
            CORTEXIQ KNOWLEDGE ENGINE
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Knowledge{" "}
            <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              Base.
            </span>
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            Your private intelligence library. Ingest documents,
            build searchable knowledge, and explore the evidence
            behind your AI.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDocuments()}
          disabled={loading || busy}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh Library
        </button>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;

          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 }}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 backdrop-blur-xl"
            >
              <div
                className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${metric.background} ${metric.color}`}
              >
                <Icon size={21} />
              </div>

              <p className="text-xs text-slate-400">
                {metric.label}
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight">
                {!loadedOnce ? "—" : metric.value}
              </p>

              <p className="mt-2 text-[10px] text-slate-600">
                {loading
                  ? "Refreshing..."
                  : "From your document library"}
              </p>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative overflow-hidden rounded-[26px] border border-violet-400/20 bg-gradient-to-br from-[#17152f] via-[#12172c] to-[#0e1a31] p-1"
      >
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-violet-500/10 blur-[90px]" />

        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);

            if (!busy && event.dataTransfer.files.length > 0) {
              void uploadFile(event.dataTransfer.files[0]);
            }
          }}
          className={`relative flex min-h-[270px] flex-col items-center justify-center rounded-[23px] border-2 border-dashed px-6 py-9 text-center transition ${
            dragging
              ? "border-violet-300 bg-violet-400/10"
              : "border-violet-400/15"
          }`}
        >
          <motion.div
            animate={uploading ? {} : { y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-400/10 text-violet-200 shadow-[0_0_45px_rgba(139,92,246,0.15)]"
          >
            {uploading ? (
              <LoaderCircle size={29} className="animate-spin" />
            ) : (
              <CloudUpload size={31} strokeWidth={1.5} />
            )}
          </motion.div>

          <h3 className="text-lg font-semibold">
            {uploading
              ? "Uploading your document..."
              : "Drop your knowledge here"}
          </h3>

          <p className="mt-3 max-w-md text-xs leading-6 text-slate-400">
            Drag a document into this workspace, or browse your
            computer to add it to your private knowledge library.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-xs font-semibold shadow-[0_10px_30px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
          >
            <UploadCloud size={17} />
            {uploading ? "Please wait..." : "Browse Files"}
          </button>

          <p className="mt-4 text-[10px] text-slate-500">
            Supported formats: PDF · DOCX · TXT
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role={notice.type === "error" ? "alert" : "status"}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${
              notice.type === "success"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                : "border-red-400/20 bg-red-400/10 text-red-200"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 size={17} />
            ) : (
              <AlertCircle size={17} />
            )}

            <span className="flex-1 leading-5">
              {notice.message}
            </span>

            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.03]">
        <div className="flex flex-col gap-5 border-b border-white/[0.07] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen size={19} className="text-violet-300" />
              <h3 className="text-base font-semibold">
                Document Library
              </h3>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Manage and explore your uploaded knowledge assets.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0c1020] px-4 py-3 sm:w-[260px]">
            <Search size={16} className="text-slate-500" />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents..."
              aria-label="Search documents"
              className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
            />
          </div>
        </div>

        {loading && !loadedOnce ? (
          <div className="flex min-h-[250px] flex-col items-center justify-center gap-4 text-slate-400">
            <LoaderCircle
              size={28}
              className="animate-spin text-violet-300"
            />
            <p className="text-xs">
              Loading your knowledge library...
            </p>
          </div>
        ) : !loadedOnce ? (
          <div className="flex min-h-[250px] flex-col items-center justify-center gap-4 px-6 text-center">
            <AlertCircle size={30} className="text-red-300" />
            <p className="text-sm text-slate-300">
              Unable to load your document library.
            </p>
            <button
              type="button"
              onClick={() => void loadDocuments()}
              className="rounded-xl bg-violet-600 px-5 py-3 text-xs font-semibold hover:bg-violet-500"
            >
              Try Again
            </button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300">
              <FileSearch size={30} />
            </div>

            <h4 className="text-sm font-semibold">
              {query
                ? "No matching documents"
                : "Your library is ready"}
            </h4>

            <p className="mt-3 max-w-sm text-xs leading-6 text-slate-500">
              {query
                ? "Try a different filename or clear the search."
                : "Upload your first document to start building your private knowledge intelligence workspace."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredDocuments.map((document, index) => (
              <motion.div
                key={document.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(index * 0.04, 0.3),
                }}
                className="group flex flex-col gap-4 px-6 py-5 transition hover:bg-white/[0.025] lg:flex-row lg:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-400/10 text-violet-300">
                    <FileText size={23} />
                  </div>

                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold text-slate-200"
                      title={document.filename}
                    >
                      {document.filename}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>
                        {getFileExtension(document.filename)}
                      </span>
                      <span>
                        {formatBytes(document.size_bytes)}
                      </span>
                      <span>
                        {formatDate(document.created_at)}
                      </span>
                      <span>
                        {document.word_count.toLocaleString()} words
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold capitalize ${
                      isIndexed(document.status)
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : ["failed", "error"].includes(
                            document.status.trim().toLowerCase()
                          )
                        ? "border-red-400/20 bg-red-400/10 text-red-300"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    {document.status}
                  </span>

                  <button
                    type="button"
                    onClick={() => void openDocument(document)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:bg-white/10"
                  >
                    Explore
                    <ChevronRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => void indexDocument(document)}
                    disabled={busy}
                    title="Index document"
                    aria-label={`Index ${document.filename}`}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-[11px] font-semibold text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-50"
                  >
                    {indexingId === document.id ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <BrainCircuit size={14} />
                    )}
                    Index
                  </button>

                  <button
                    type="button"
                    onClick={() => void deleteDocument(document)}
                    disabled={busy}
                    title="Delete document"
                    aria-label={`Delete ${document.filename}`}
                    className="rounded-lg border border-red-400/10 p-2 text-slate-500 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
                  >
                    {deletingId === document.id ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/[0.07] px-6 py-4 text-[11px] text-slate-500">
          <span>
            Showing {filteredDocuments.length} of{" "}
            {documents.length} documents
          </span>

          <span className="flex items-center gap-2">
            <ShieldCheck
              size={14}
              className="text-violet-300"
            />
            Private workspace
          </span>
        </div>
      </section>

      <AnimatePresence>
        {selectedDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-sm"
            onClick={closeDocument}
          >
            <motion.aside
              initial={{ x: 440 }}
              animate={{ x: 0 }}
              exit={{ x: 440 }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 260,
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Document details"
              className="flex h-full w-full max-w-[520px] flex-col border-l border-white/10 bg-[#0e1223] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300">
                    <FileText size={21} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      Document Intelligence
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Knowledge asset details
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDocument}
                  aria-label="Close document details"
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-7 overflow-y-auto p-6">
                <div className="rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 p-5">
                  <div className="mb-4 flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-violet-300">
                    <Sparkles size={13} />
                    KNOWLEDGE ASSET
                  </div>

                  <h3 className="break-words text-lg font-bold">
                    {selectedDocument.filename}
                  </h3>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500">
                        File size
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatBytes(selectedDocument.size_bytes)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-500">
                        Word count
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {selectedDocument.word_count.toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-500">
                        Uploaded
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatDate(selectedDocument.created_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-500">
                        Status
                      </p>
                      <p className="mt-1 text-sm font-semibold capitalize text-violet-200">
                        {selectedDocument.status}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <Layers3
                          size={17}
                          className="text-violet-300"
                        />
                        Indexed Chunks
                      </h4>

                      <p className="mt-2 text-[11px] text-slate-500">
                        Text passages available for retrieval.
                      </p>
                    </div>

                    {!chunksLoading && !chunksError && (
                      <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">
                        {chunks.length}
                      </span>
                    )}
                  </div>

                  {chunksLoading ? (
                    <div className="flex items-center gap-3 py-8 text-xs text-slate-400">
                      <LoaderCircle
                        size={18}
                        className="animate-spin text-violet-300"
                      />
                      Loading document chunks...
                    </div>
                  ) : chunksError ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-400/20 bg-red-400/10 p-5"
                    >
                      <p className="text-xs text-red-200">
                        {chunksError}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void openDocument(selectedDocument)
                        }
                        className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold hover:bg-violet-500"
                      >
                        Retry
                      </button>
                    </div>
                  ) : chunks.length === 0 ? (
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-6 text-center">
                      <File
                        size={26}
                        className="mx-auto text-slate-600"
                      />
                      <p className="mt-3 text-xs text-slate-400">
                        No indexed chunks available.
                      </p>
                      <p className="mt-2 text-[11px] text-slate-600">
                        Index this document to prepare it for search.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chunks.map((chunk) => (
                        <div
                          key={`${chunk.id}-${chunk.chunk_index}`}
                          className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-violet-300">
                              CHUNK {chunk.chunk_index + 1}
                            </span>

                            <span className="text-[10px] text-slate-500">
                              {chunk.word_count} words
                            </span>
                          </div>

                          <p className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-400">
                            {chunk.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/[0.07] p-6">
                <button
                  type="button"
                  onClick={() => {
                    const document = selectedDocument;
                    closeDocument();
                    void indexDocument(document);
                  }}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-xs font-semibold transition hover:bg-violet-500 disabled:opacity-50"
                >
                  <BrainCircuit size={17} />
                  Index Document
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-600">
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} />
          Documents are accessed using your authenticated session.
        </span>

        <span className="flex items-center gap-2">
          <ArrowDownToLine size={14} />
          CortexIQ Knowledge Intelligence
        </span>
      </div>
    </div>
  );
}
