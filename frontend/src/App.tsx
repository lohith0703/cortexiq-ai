
import { useCallback, useEffect, useRef, useState } from "react";

import AuthPage from "./auth/AuthPage";
import CortexWorkspace from "./CortexWorkspace";

type CurrentUser = {
  id: string;
  email: string;
  created_at?: string;
};

type Session = {
  accessToken: string;
  user: CurrentUser;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const loginAttemptRef = useRef(0);

  const logout = useCallback(() => {
    loginAttemptRef.current += 1;
    setSession(null);
  }, []);

  const handleLogin = useCallback(async (accessToken: string) => {
    const attempt = ++loginAttemptRef.current;

    const response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Your session is invalid or expired. Please sign in again."
          : "Unable to verify your account. Please try again."
      );
    }

    const user: CurrentUser = await response.json();

    if (
      typeof user.id !== "string" ||
      typeof user.email !== "string"
    ) {
      throw new Error("Invalid account information returned by the server.");
    }

    if (attempt !== loginAttemptRef.current) return;

    setSession({ accessToken, user });
  }, []);

  useEffect(() => {
    if (!session) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
          cache: "no-store",
        });

        if (response.status === 401) {
          logout();
        }
      } catch {
        // Temporary network failures do not invalidate the session.
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [session, logout]);

  if (!session) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <CortexWorkspace
      accessToken={session.accessToken}
      user={session.user}
      onLogout={logout}
    />
  );
}
