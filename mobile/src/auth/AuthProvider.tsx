import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export type Me = { id: string; email: string; fullName: string; phone: string | null; role: "CUSTOMER" | "ADMIN" };

type AuthState = {
  status: "loading" | "signedOut" | "signedIn";
  session: Session | null;
  me: Me | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/** Friendly messages for Supabase Auth errors; never echoes raw server text. */
function signInMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Please verify your email address first, using the link we sent you.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    default:
      return "We couldn't sign you in. Please try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Profile cached per user id; ignored unless it belongs to the current session.
  const [profile, setProfile] = useState<{ userId: string; me: Me } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // The profile (name, role) always comes from the server, never from the token.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    api<Me>("/me")
      .then((me) => {
        if (active) setProfile({ userId, me });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);
  const me = profile && profile.userId === userId ? profile.me : null;

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? signInMessage(error.code) : null;
  }, []);

  const signOut = useCallback(async () => {
    // Ends this device's session and wipes it from secure storage.
    await supabase.auth.signOut({ scope: "local" });
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status: loading ? "loading" : session ? "signedIn" : "signedOut", session, me, signIn, signOut }),
    [loading, session, me, signIn, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
