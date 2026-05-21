"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { ClientSettings, SubMenu } from "@/types";


function getClientIdFromToken(): string {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem("token");
  if (!token) return "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.client_id || "";
  } catch {
    return "";
  }
}

const DEFAULTS: ClientSettings = {
  welcome_message: "Hello! How can I help you today?",
  chatbot_title: "AI Front Desk",
  system_prompt: `You are a helpful front desk assistant for an educational institution.
Answer questions ONLY based on the provided context. Do not make up information.
If the context does not contain enough information to answer the question, say so clearly.
Be concise, friendly, and professional.`,
  theme_color: "#1E40AF",
  max_history_turns: 5,
  menu_options: [],
};

function newSubMenu(): SubMenu {
  return { id: crypto.randomUUID(), label: "New Submenu", sub_questions: [] };
}

export default function SettingsPage() {
  const [clientId, setClientId] = useState("");
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<ClientSettings>(DEFAULTS);

  useEffect(() => {
    const id = getClientIdFromToken();
    setClientId(id);

    api.getMyProfile().then((profile) => {
      // settings are stored under profile.client.settings in MongoDB
      const s = (profile.client as unknown as { settings?: Partial<ClientSettings> })?.settings;
      setSettings({
        welcome_message: s?.welcome_message ?? DEFAULTS.welcome_message,
        chatbot_title: s?.chatbot_title ?? DEFAULTS.chatbot_title,
        system_prompt: s?.system_prompt ?? DEFAULTS.system_prompt,
        theme_color: s?.theme_color ?? DEFAULTS.theme_color,
        max_history_turns: s?.max_history_turns ?? DEFAULTS.max_history_turns,
        menu_options: s?.menu_options ?? DEFAULTS.menu_options,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const widgetCode = `<script src="${backendUrl}/api/clients/${clientId}/widget.js" data-client-id="${clientId}" data-theme-color="${settings.theme_color}"></script>`;

  function copyCode() {
    navigator.clipboard.writeText(widgetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveSettings() {
    if (!clientId) return;
    setSaving(true);
    setError("");
    try {
      await api.updateClientSettings(clientId, settings as unknown as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <span className="text-sm text-gray-500">
          Client ID: <span className="font-medium text-blue-600">{clientId}</span>
        </span>
      </div>

      {/* Chatbot Behaviour */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold">Chatbot Behaviour</h2>
        <p className="mb-5 text-sm text-gray-500">
          Configure how the chatbot introduces itself and responds to users.
        </p>

        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Welcome Message
            </label>
            <p className="mb-2 text-xs text-gray-400">
              The first message users see when they open the chat widget.
            </p>
            <textarea
              value={settings.welcome_message}
              onChange={(e) =>
                setSettings((s) => ({ ...s, welcome_message: e.target.value }))
              }
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={"Hello! 👋\nWelcome to our support system.\nHow can I help you today?"}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Chatbot Title
            </label>
            <p className="mb-2 text-xs text-gray-400">
              The title displayed at the top of the chat window.
            </p>
            <input
              type="text"
              value={settings.chatbot_title}
              onChange={(e) =>
                setSettings((s) => ({ ...s, chatbot_title: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. AI Front Desk"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              System Prompt
            </label>
            <p className="mb-2 text-xs text-gray-400">
              Instructions that define the chatbot&apos;s personality, tone, and rules. This is
              sent to the AI on every query — be specific about your institution&apos;s name and
              style.
            </p>
            <textarea
              value={settings.system_prompt}
              onChange={(e) =>
                setSettings((s) => ({ ...s, system_prompt: e.target.value }))
              }
              rows={7}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="You are a helpful assistant for..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Theme Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.theme_color}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, theme_color: e.target.value }))
                  }
                  className="h-10 w-14 cursor-pointer rounded border border-gray-300"
                />
                <input
                  value={settings.theme_color}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, theme_color: e.target.value }))
                  }
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  placeholder="#1E40AF"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Conversation Memory (turns)
              </label>
              <p className="mb-1 text-xs text-gray-400">
                How many past exchanges the bot remembers.
              </p>
              <select
                value={settings.max_history_turns}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    max_history_turns: Number(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {[1, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} turns
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && (
            <span className="text-sm text-green-600">Settings saved!</span>
          )}
        </div>
      </div>

      {/* Menu Options & FAQs */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Menu Options &amp; FAQs</h2>
            <p className="text-sm text-gray-500">
              Create menu topics → submenus → questions that users can tap in the chatbot.
            </p>
          </div>
          <button
            onClick={() => {
              setSettings((s) => ({
                ...s,
                menu_options: [
                  ...(s.menu_options || []),
                  { id: crypto.randomUUID(), label: "New Topic", submenus: [] }
                ]
              }));
            }}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            + Add Topic
          </button>
        </div>

        <div className="space-y-4">
          {(settings.menu_options || []).map((menu, mIndex) => (
            <div key={menu.id} className="rounded-lg border border-gray-200 p-4">
              {/* ── Menu Topic Row ── */}
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-400 w-14 shrink-0">Menu</span>
                <input
                  value={menu.label}
                  onChange={(e) => {
                    const newOpts = [...(settings.menu_options || [])];
                    newOpts[mIndex] = { ...newOpts[mIndex], label: e.target.value };
                    setSettings({ ...settings, menu_options: newOpts });
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold"
                  placeholder="Topic Name (e.g. Admissions)"
                />
                <button
                  onClick={() => {
                    const newOpts = (settings.menu_options || []).filter((_, i) => i !== mIndex);
                    setSettings({ ...settings, menu_options: newOpts });
                  }}
                  className="text-red-400 hover:text-red-600 text-lg leading-none"
                  title="Remove Topic"
                >
                  ✕
                </button>
              </div>

              {/* ── Submenus ── */}
              <div className="space-y-3 pl-4 border-l-2 border-blue-100 ml-2">
                {(menu.submenus || []).map((sm, smIndex) => (
                  <div key={sm.id} className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    {/* Submenu row */}
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-blue-400 w-20 shrink-0">Submenu</span>
                      <input
                        value={sm.label}
                        onChange={(e) => {
                          const newOpts = [...(settings.menu_options || [])];
                          const newSubmenus = [...(newOpts[mIndex].submenus || [])];
                          newSubmenus[smIndex] = { ...newSubmenus[smIndex], label: e.target.value };
                          newOpts[mIndex] = { ...newOpts[mIndex], submenus: newSubmenus };
                          setSettings({ ...settings, menu_options: newOpts });
                        }}
                        className="flex-1 rounded-lg border border-blue-200 px-3 py-1 text-sm font-medium"
                        placeholder="Submenu Name (e.g. UG Admissions)"
                      />
                      <button
                        onClick={() => {
                          const newOpts = [...(settings.menu_options || [])];
                          newOpts[mIndex] = {
                            ...newOpts[mIndex],
                            submenus: newOpts[mIndex].submenus.filter((_, i) => i !== smIndex)
                          };
                          setSettings({ ...settings, menu_options: newOpts });
                        }}
                        className="text-blue-300 hover:text-red-500"
                        title="Remove Submenu"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Sub-Questions */}
                    <div className="space-y-1.5 pl-4 border-l border-blue-200 ml-2">
                      <p className="text-xs font-medium text-gray-400">Questions:</p>
                      {(sm.sub_questions || []).map((sq, sqIndex) => (
                        <div key={sqIndex} className="flex items-center gap-2">
                          <input
                            value={sq}
                            onChange={(e) => {
                              const newOpts = [...(settings.menu_options || [])];
                              const newSubmenus = [...newOpts[mIndex].submenus];
                              const newQs = [...newSubmenus[smIndex].sub_questions];
                              newQs[sqIndex] = e.target.value;
                              newSubmenus[smIndex] = { ...newSubmenus[smIndex], sub_questions: newQs };
                              newOpts[mIndex] = { ...newOpts[mIndex], submenus: newSubmenus };
                              setSettings({ ...settings, menu_options: newOpts });
                            }}
                            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm text-gray-700"
                            placeholder="e.g. How do I apply?"
                          />
                          <button
                            onClick={() => {
                              const newOpts = [...(settings.menu_options || [])];
                              const newSubmenus = [...newOpts[mIndex].submenus];
                              newSubmenus[smIndex] = {
                                ...newSubmenus[smIndex],
                                sub_questions: newSubmenus[smIndex].sub_questions.filter((_, i) => i !== sqIndex)
                              };
                              newOpts[mIndex] = { ...newOpts[mIndex], submenus: newSubmenus };
                              setSettings({ ...settings, menu_options: newOpts });
                            }}
                            className="text-gray-300 hover:text-red-500"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newOpts = [...(settings.menu_options || [])];
                          const newSubmenus = [...newOpts[mIndex].submenus];
                          newSubmenus[smIndex] = {
                            ...newSubmenus[smIndex],
                            sub_questions: [...newSubmenus[smIndex].sub_questions, ""]
                          };
                          newOpts[mIndex] = { ...newOpts[mIndex], submenus: newSubmenus };
                          setSettings({ ...settings, menu_options: newOpts });
                        }}
                        className="mt-1 text-xs font-medium text-blue-500 hover:text-blue-700"
                      >
                        + Add Question
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const newOpts = [...(settings.menu_options || [])];
                    newOpts[mIndex] = {
                      ...newOpts[mIndex],
                      submenus: [...(newOpts[mIndex].submenus || []), newSubMenu()]
                    };
                    setSettings({ ...settings, menu_options: newOpts });
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50 transition-colors"
                >
                  + Add Submenu
                </button>
              </div>
            </div>
          ))}
          {!(settings.menu_options?.length) && (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              No menu topics yet. Click &quot;Add Topic&quot; to start.
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && (
            <span className="text-sm text-green-600">Settings saved!</span>
          )}
        </div>
      </div>

      {/* Widget Integration */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold">Widget Integration</h2>
        <p className="mb-5 text-sm text-gray-500">
          Paste this script tag before the closing &lt;/body&gt; tag on your website.
        </p>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Backend URL
          </label>
          <input
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="https://your-backend.onrender.com"
          />
        </div>

        <div className="relative">
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
            {widgetCode}
          </pre>
          <button
            onClick={copyCode}
            className="absolute right-3 top-3 rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Quick Guide */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Quick Setup Guide</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-600">
          <li>Upload your institution&apos;s documents in the <strong>Documents</strong> section</li>
          <li>Configure the chatbot behaviour above and click <strong>Save Settings</strong></li>
          <li>Test the chatbot using the <strong>Test Chat</strong> page</li>
          <li>Copy the widget code and paste it on your website</li>
        </ol>
      </div>
    </div>
  );
}
