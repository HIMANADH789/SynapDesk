"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createElement } from "react";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  role: string | null;
  clientId: string | null;
  login: (token: string) => void;
  logout: () => void;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    const exp = payload.exp as number | undefined;
    if (!exp) return true;
    // Add 30s buffer to account for clock drift
    return Date.now() / 1000 > exp - 30;
  } catch {
    return true;
  }
}

const AuthContext = createContext<AuthState>({
  token: null,
  isAuthenticated: false,
  role: null,
  clientId: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      if (isTokenExpired(stored)) {
        // Token is expired — clear it and send to login
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }
      setToken(stored);
      const payload = decodeJwtPayload(stored);
      setRole((payload.role as string) ?? null);
      setClientId((payload.client_id as string) ?? null);
    }
  }, []);

  const login = useCallback((newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    const payload = decodeJwtPayload(newToken);
    const userRole = (payload.role as string) ?? null;
    const userClientId = (payload.client_id as string) ?? null;
    setRole(userRole);
    setClientId(userClientId);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setRole(null);
    setClientId(null);
    window.location.href = "/login";
  }, []);

  return createElement(
    AuthContext.Provider,
    {
      value: { token, isAuthenticated: !!token, role, clientId, login, logout },
    },
    children
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Decode token and return role + clientId without React context (for middleware/layout use) */
export function getTokenPayload(): { role: string | null; clientId: string | null; expired: boolean } {
  if (typeof window === "undefined") return { role: null, clientId: null, expired: false };
  const token = localStorage.getItem("token");
  if (!token) return { role: null, clientId: null, expired: false };
  if (isTokenExpired(token)) {
    localStorage.removeItem("token");
    return { role: null, clientId: null, expired: true };
  }
  const payload = decodeJwtPayload(token);
  return {
    role: (payload.role as string) ?? null,
    clientId: (payload.client_id as string) ?? null,
    expired: false,
  };
}
