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
    setRole((payload.role as string) ?? null);
    setClientId((payload.client_id as string) ?? null);
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
