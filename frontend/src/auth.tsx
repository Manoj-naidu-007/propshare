import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setToken as saveToken, TOKEN_KEY } from "./api";
import { storage } from "@/src/utils/storage";

export type Role = "Admin" | "Company" | "Investor";
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  status?: string;
  kyc_status?: string;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (payload: { email: string; password: string; name: string; role: Role; company_name?: string }) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const t = await storage.secureGet<string>(TOKEN_KEY, "");
      if (t) {
        const me = await api<User>("/auth/me");
        setUser(me);
      }
    } catch {
      await saveToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const signIn = async (email: string, password: string) => {
    const data = await api<{ access_token: string; user: User }>("/auth/login", { body: { email, password } });
    await saveToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const signUp = async (payload: { email: string; password: string; name: string; role: Role; company_name?: string }) => {
    const data = await api<{ access_token: string; user: User }>("/auth/register", { body: payload });
    await saveToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const signOut = async () => {
    await saveToken(null);
    setUser(null);
  };

  const refresh = async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {}
  };

  return (
    <AuthCtx.Provider value={{ user, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
