"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import type { ChatMessage, Source } from "@/types";

function getClientIdFromToken(): string {
  if (typeof window === "undefined") return "default";
  const token = localStorage.getItem("token");
  if (!token) return "default";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.client_id || "default";
  } catch {
    return "default";
  }
}

function MessageText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <span className="block break-words text-sm leading-relaxed">
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </span>
  );
}

export default function ChatTestPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [clientId, setClientId] = useState("default");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = getClientIdFromToken();
    setClientId(id);

    // Load welcome message from client settings
    api.getMyProfile().then((profile) => {
      const s = (profile.client as unknown as { settings?: { welcome_message?: string } })?.settings;
      const welcome = s?.welcome_message ?? "Hello! How can I help you today?";
      setMessages([{ role: "assistant", content: welcome }]);
    }).catch(() => {
      setMessages([{ role: "assistant", content: "Hello! How can I help you today?" }]);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await api.chat(clientId, userMessage, sessionId);
      setSessionId(res.session_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.response, sources: res.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, something went wrong. Please try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setSessionId(undefined);
    api.getMyProfile().then((profile) => {
      const s = (profile.client as unknown as { settings?: { welcome_message?: string } })?.settings;
      const welcome = s?.welcome_message ?? "Hello! How can I help you today?";
      setMessages([{ role: "assistant", content: welcome }]);
    }).catch(() => {});
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Test Chat</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Client: <span className="font-medium text-gray-700">{clientId}</span>
          </span>
          <button
            onClick={clearChat}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl bg-white p-4 shadow-sm">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <MessageText text={msg.content} />
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 border-t border-gray-200 pt-2">
                    <p className="text-xs font-medium text-gray-400">Sources:</p>
                    {msg.sources.map((s: Source, j: number) => (
                      <p key={j} className="text-xs text-gray-400">
                        {s.filename}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-100 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
