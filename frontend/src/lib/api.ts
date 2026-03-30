const API_BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, client_id: string) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, client_id }),
    }),

  // Documents
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{
      doc_id: string;
      filename: string;
      status: string;
      chunks_count: number;
    }>("/documents/upload", { method: "POST", body: form });
  },

  listDocuments: () =>
    request<{ documents: import("@/types").Document[]; total: number }>(
      "/documents"
    ),

  deleteDocument: (docId: string) =>
    request(`/documents/${docId}`, { method: "DELETE" }),

  // Chat
  chat: (clientId: string, message: string, sessionId?: string) =>
    request<import("@/types").ChatResponse>(
      `/chat/${clientId}/query`,
      {
        method: "POST",
        body: JSON.stringify({ message, session_id: sessionId }),
      }
    ),

  getChatHistory: (clientId: string, sessionId: string) =>
    request<{ session_id: string; messages: import("@/types").ChatMessage[] }>(
      `/chat/${clientId}/history/${sessionId}`
    ),

  getQuota: () => request<{ remaining_daily: number }>("/chat/quota"),

  // Analytics
  getUsage: () => request<import("@/types").UsageStats>("/analytics/usage"),

  getQueries: (page = 1, pageSize = 20) =>
    request<{
      logs: import("@/types").QueryLog[];
      total: number;
      page: number;
    }>(`/analytics/queries?page=${page}&page_size=${pageSize}`),

  // Profile & Client settings
  getMyProfile: () =>
    request<{
      email: string;
      client_id: string;
      role: string;
      client: import("@/types").ClientSettings | null;
    }>("/clients/me/profile"),

  updateClientSettings: (
    clientId: string,
    settings: Partial<import("@/types").ClientSettings>
  ) =>
    request(`/clients/${clientId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(settings),
    }),
};
