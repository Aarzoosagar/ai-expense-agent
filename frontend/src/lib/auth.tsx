import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokenStore } from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

interface TokenResponse {
  access_token: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get<User>("/auth/me")
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const h = () => logout();
    window.addEventListener("aea:unauthorized", h);
    return () => window.removeEventListener("aea:unauthorized", h);
  }, [logout]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      logout,
      login: async (email, password) => {
        const r = await api.post<TokenResponse>("/auth/login", { email, password });
        tokenStore.set(r.access_token);
        qc.clear();
        setUser(r.user);
      },
      register: async (name, email, password) => {
        const r = await api.post<TokenResponse>("/auth/register", { name, email, password });
        tokenStore.set(r.access_token);
        qc.clear();
        setUser(r.user);
      },
    }),
    [user, loading, logout, qc],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
