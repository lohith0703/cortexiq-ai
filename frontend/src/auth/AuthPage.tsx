
import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSearch,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type AuthMode = "login" | "register";

type AuthPageProps = {
  onLogin: (accessToken: string) => Promise<void>;
};

type ApiError = {
  detail?: string | Array<{ msg?: string }>;
};

function getErrorMessage(data: ApiError | null): string {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((item) => item.msg || "Invalid input")
      .join(". ");
  }

  return "Unable to complete your request. Please try again.";
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getErrorMessage(data));
      }

      if (mode === "register") {
        setMode("login");
        setPassword("");
        setSuccess("Account created successfully. Please sign in.");
        return;
      }

      if (typeof data?.access_token !== "string") {
        throw new Error("The server did not return an access token.");
      }

      await onLogin(data.access_token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode((current) => (current === "login" ? "register" : "login"));
    setError("");
    setSuccess("");
    setPassword("");
  }

  return (
    <div className="relative flex min-h-screen bg-[#080b16] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-[600px] w-[600px] rounded-full bg-violet-700/10 blur-[150px]" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[130px]" />
      </div>

      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-gradient-to-br from-[#15112b] via-[#10152b] to-[#0b1327] p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700">
            <BrainCircuit size={25} />
          </div>

          <div>
            <h1 className="text-xl font-bold">CortexIQ</h1>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-violet-300/70">
              INTELLIGENCE OS
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
            className="mb-12 flex h-28 w-28 items-center justify-center rounded-[32px] border border-violet-300/25 bg-violet-400/10 shadow-[0_0_100px_rgba(139,92,246,0.25)] backdrop-blur-xl"
          >
            <BrainCircuit size={60} className="text-violet-200" />
          </motion.div>

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-[11px] text-violet-200">
            <Sparkles size={14} />
            KNOWLEDGE MEETS INTELLIGENCE
          </div>

          <h2 className="max-w-[520px] text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Unlock the power of
            <span className="block bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              everything you know.
            </span>
          </h2>

          <p className="mt-6 max-w-[450px] text-sm leading-7 text-slate-400">
            Transform documents into actionable intelligence with
            hybrid retrieval, AI-powered analysis, and
            evidence-grounded answers.
          </p>

          <div className="mt-10 grid max-w-[470px] gap-4">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <FileSearch size={19} className="text-violet-300" />
              Intelligent document discovery
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-300">
              <ShieldCheck size={19} className="text-cyan-300" />
              Private knowledge workspaces
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 size={19} className="text-emerald-300" />
              Source-grounded AI answers
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          CortexIQ · Enterprise Knowledge Intelligence
        </p>
      </div>

      <div className="relative flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-[420px]"
        >
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <BrainCircuit size={28} className="text-violet-300" />
            <span className="text-xl font-bold">CortexIQ</span>
          </div>

          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300">
              <LockKeyhole size={23} />
            </div>

            <h2 className="text-3xl font-bold tracking-tight">
              {mode === "login"
                ? "Welcome back."
                : "Create your account."}
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              {mode === "login"
                ? "Sign in to access your intelligence workspace."
                : "Start building your private knowledge universe."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-semibold text-slate-300"
              >
                Email address
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 focus-within:border-violet-400/60">
                <Mail size={18} className="text-slate-500" />

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent py-4 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-semibold text-slate-300"
              >
                Password
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 focus-within:border-violet-400/60">
                <LockKeyhole size={18} className="text-slate-500" />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  required
                  minLength={mode === "register" ? 12 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-transparent py-4 text-sm text-white outline-none placeholder:text-slate-600"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  className="text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              {mode === "register" && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Use at least 12 characters.
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs leading-5 text-red-200"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs leading-5 text-emerald-200"
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 text-sm font-semibold shadow-[0_12px_35px_rgba(124,58,237,0.2)] transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in to CortexIQ"
                  : "Create account"}

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-8 border-t border-white/[0.07] pt-7 text-center">
            <p className="text-sm text-slate-400">
              {mode === "login"
                ? "New to CortexIQ?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="font-semibold text-violet-300 hover:text-violet-200"
              >
                {mode === "login"
                  ? "Create an account"
                  : "Sign in"}
              </button>
            </p>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-600">
            <ShieldCheck size={15} />
            Secure authentication powered by CortexIQ
          </div>
        </motion.div>
      </div>
    </div>
  );
}
