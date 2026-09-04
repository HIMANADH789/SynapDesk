"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

// ── Rate limits section (shared by all setups) ─────────────────────────────────
function RateLimitsSection({ cfg, editable, onSave }: {
  cfg: Record<string, unknown>;
  editable: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [rpm, setRpm] = useState(Number(cfg.rate_limit_rpm ?? 20));
  const [rpd, setRpd] = useState(Number(cfg.rate_limit_rpd ?? 200));
  const [session, setSession] = useState(Number(cfg.max_queries_per_session ?? 50));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try { await onSave({ rate_limit_rpm: rpm, rate_limit_rpd: rpd, max_queries_per_session: session }); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Section title="Rate Limits">
      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
        These limits apply per visitor IP address for this setup only. Set to 0 to disable.
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Row label="Requests / minute" hint="0 = unlimited">
          <div className="flex items-center gap-2">
            <input type="number" min={0} className={inputCls} value={rpm} onChange={e => setRpm(Number(e.target.value))} disabled={!editable} />
            <span className="text-xs text-gray-400 shrink-0">req/min</span>
          </div>
        </Row>
        <Row label="Requests / day" hint="0 = unlimited">
          <div className="flex items-center gap-2">
            <input type="number" min={0} className={inputCls} value={rpd} onChange={e => setRpd(Number(e.target.value))} disabled={!editable} />
            <span className="text-xs text-gray-400 shrink-0">req/day</span>
          </div>
        </Row>
        <Row label="Max messages / session" hint="0 = unlimited">
          <input type="number" min={0} className={inputCls} value={session} onChange={e => setSession(Number(e.target.value))} disabled={!editable} />
        </Row>
      </div>
      {editable && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving…" : "Save Limits"}</button>
          {saved && <span className="text-xs text-green-600">Saved</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </Section>
  );
}

// ── Context-Adaptive RAG Section ──────────────────────────────────────────────
function ContextAdaptiveRAGSection({ cfg, editable, onSave }: {
  cfg: Record<string, unknown>;
  editable: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [mode, setMode] = useState<string>(String(cfg.context_mode ?? "none"));
  const [instructions, setInstructions] = useState<string>(String(cfg.context_instructions ?? ""));
  const [capacity, setCapacity] = useState<number>(Number(cfg.context_capacity ?? 4));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await onSave({
        context_mode: mode,
        context_instructions: instructions,
        context_capacity: capacity,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save context configuration");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="🧠 Context-Adaptive RAG & Context Carrying">
      <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-100 p-3.5 text-xs text-indigo-900">
        <div className="space-y-1">
          <p className="font-semibold text-indigo-950 flex items-center gap-1.5">
            <span>Adaptive Multi-Turn Memory</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
              mode === "adaptive" ? "bg-indigo-200 text-indigo-900" :
              mode === "full" ? "bg-purple-200 text-purple-900" : "bg-gray-200 text-gray-700"
            }`}>
              Mode: {mode.toUpperCase()}
            </span>
          </p>
          <p className="text-indigo-800">
            Resolves implicit pronouns (&quot;it&quot;, &quot;its fee&quot;, &quot;their cutoff&quot;) and elided follow-up queries using preceding conversation turns before vector retrieval.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Row label="Context Carrying Mode" hint="Select how contextual information flows across turns">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={!editable}
            className={inputCls}
          >
            <option value="none">None (Standard / Standalone Retrieval — Default)</option>
            <option value="adaptive">Adaptive (Auto-detects pronouns &amp; implicit follow-ups)</option>
            <option value="full">Full (Always re-synthesizes query against chat history)</option>
          </select>
        </Row>

        <Row label="Context Memory Capacity" hint="Number of preceding turns (user+assistant) to scan">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={10}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(1, Math.min(10, Number(e.target.value))))}
              disabled={!editable}
              className={inputCls}
            />
            <span className="text-xs text-gray-500 shrink-0">turns (recommended: 4)</span>
          </div>
        </Row>
      </div>

      <Row
        label="Tracked Entities & Developer Directives"
        hint="Specify exact entity types, schemas, and fields to preserve in development terminology (zero translation overhead)"
      >
        <textarea
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={!editable}
          placeholder="e.g., Track course_name, branch, fee_structure, quota, admission_category, eligibility_criteria, application_deadline, semester."
          className={`${inputCls} font-mono text-xs`}
        />
      </Row>

      {/* Operational Explanation Card */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-700">How this works in runtime:</p>
        <p>• <strong>Turn 1:</strong> User asks: <em>&quot;Tell me about B.Tech in Artificial Intelligence&quot;</em></p>
        <p>• <strong>Turn 2:</strong> User asks: <em>&quot;What is its fee and when is the last date?&quot;</em></p>
        <p>• <strong>Adaptive RAG:</strong> Resolves pronoun &apos;its&apos; to <em>&quot;B.Tech in Artificial Intelligence fee structure and application deadline&quot;</em> for precise vector retrieval and reranking.</p>
      </div>

      {editable && (
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Context Settings"}
          </button>
          {saved && <span className="text-xs font-medium text-green-600">✓ Context Settings Saved</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </Section>
  );
}

// ── Token security (widget / web_api) ──────────────────────────────────────────
function TokenSection({ cfg, channel, clientId, editable }: {
  cfg: Record<string, unknown>;
  channel: string;
  clientId: string;
  editable: boolean;
}) {
  const [tokenSet, setTokenSet] = useState(Boolean(cfg.token_set));
  const [newToken, setNewToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function rotate() {
    setSaving(true); setError("");
    try { const res = await api.rotateSetupToken(clientId, channel); setNewToken(res.token); setTokenSet(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function disable() {
    if (!confirm("Remove token? The setup will be open to all requests.")) return;
    setSaving(true); setError("");
    try { await api.disableSetupToken(clientId, channel); setTokenSet(false); setNewToken(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Section title="API Key Security">
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">REST API — server-side token authentication</p>
        <p>The REST API is called from your institution's backend server (not a browser), so Origin-based protection does not apply. Use this API key in your server's environment variables and send it as <code className="font-mono bg-blue-100 px-1">X-Api-Key</code> with every request.</p>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm text-gray-600">Status:</span>
        {tokenSet
          ? <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">API Key Active</span>
          : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Open (no key required)</span>}
      </div>
      <p className="text-xs text-gray-500">API keys are shown only once at generation time and never stored in plain text.</p>

      {newToken && (
        <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4 space-y-2">
          <p className="text-xs font-medium text-green-700">Copy this token now — it will never be shown again:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white border border-green-200 px-3 py-2 text-sm font-mono text-gray-900 break-all">{newToken}</code>
            <button onClick={() => { navigator.clipboard.writeText(newToken); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewToken("")} className="text-xs text-green-600 hover:underline">I've saved it, dismiss</button>
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap gap-2 mt-1">
          <button onClick={rotate} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Generating…" : tokenSet ? "Rotate API Key" : "Generate API Key"}
          </button>
          {tokenSet && (
            <button onClick={disable} disabled={saving} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
              Remove API Key
            </button>
          )}
          {error && <span className="self-center text-xs text-red-600">{error}</span>}
        </div>
      )}
    </Section>
  );
}

// ── Allowed Origins (widget only) ─────────────────────────────────────────────
function OriginsSection({ cfg, clientId, channel, editable, onSave }: {
  cfg: Record<string, unknown>; clientId: string; channel: string; editable: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [origins, setOrigins] = useState<string[]>((cfg.allowed_origins as string[]) || []);
  const [newOrigin, setNewOrigin] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try { await onSave({ allowed_origins: origins }); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    finally { setSaving(false); }
  }

  return (
    <Section title="Allowed Origins">
      <p className="text-xs text-gray-500">Leave empty to allow all origins. Add domains to restrict where the widget can be embedded.</p>
      <div className="flex flex-wrap gap-2">
        {origins.map(o => (
          <span key={o} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-mono">
            {o}
            {editable && <button onClick={() => setOrigins(prev => prev.filter(x => x !== o))} className="text-gray-400 hover:text-red-500">&times;</button>}
          </span>
        ))}
      </div>
      {editable && (
        <>
          <div className="flex gap-2">
            <input className={`${inputCls} flex-1`} value={newOrigin} onChange={e => setNewOrigin(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (newOrigin.trim()) { setOrigins(p => [...p, newOrigin.trim()]); setNewOrigin(""); } } }}
              placeholder="https://yourinstitution.edu" />
            <button onClick={() => { if (newOrigin.trim()) { setOrigins(p => [...p, newOrigin.trim()]); setNewOrigin(""); } }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Add</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save Origins"}
            </button>
            {saved && <span className="text-xs text-green-600">Saved</span>}
          </div>
        </>
      )}
    </Section>
  );
}

// ── Per-channel credential forms ───────────────────────────────────────────────

function CredentialField({ label, hint, value, onChange, secret = false, editable = true }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; secret?: boolean; editable?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <Row label={label} hint={hint}>
      <div className="relative">
        <input type={secret && !show ? "password" : "text"} className={`${inputCls} font-mono ${secret ? "pr-14" : ""}`}
          value={value} onChange={e => onChange(e.target.value)} disabled={!editable}
          placeholder={value.includes("••") ? "(unchanged)" : ""} />
        {secret && editable && (
          <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-600">
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </Row>
  );
}

function WebhookUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <code className="flex-1 text-xs font-mono text-gray-800 break-all">{url}</code>
      <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function WhatsAppCredentials({ cfg, clientId, editable, onSave }: { cfg: Record<string, unknown>; clientId: string; editable: boolean; onSave: (f: Record<string, unknown>) => Promise<void> }) {
  const [phoneId, setPhoneId] = useState(String(cfg.phone_number_id || ""));
  const [token, setToken] = useState(String(cfg.access_token || ""));
  const [secret, setSecret] = useState(String(cfg.app_secret || ""));
  const [verify, setVerify] = useState(String(cfg.verify_token || ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    try {
      const fields: Record<string, unknown> = { verify_token: verify };
      if (phoneId && !phoneId.includes("•")) fields.phone_number_id = phoneId;
      if (token && !token.includes("•")) fields.access_token = token;
      if (secret && !secret.includes("•")) fields.app_secret = secret;
      await onSave(fields); setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Section title="WhatsApp Credentials">
      <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-800">
        <p className="font-semibold mb-1">Webhook URL — register in this client's Meta App:</p>
        <WebhookUrl url={`${BACKEND_URL}/api/integrations/${clientId}/whatsapp`} />
        <p className="mt-2">Each institution has a unique webhook URL.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CredentialField label="Phone Number ID" hint="From Meta WhatsApp dashboard" value={phoneId} onChange={setPhoneId} editable={editable} />
        <CredentialField label="Access Token" hint="System User Token" value={token} onChange={setToken} secret editable={editable} />
        <CredentialField label="App Secret" hint="For signature verification" value={secret} onChange={setSecret} secret editable={editable} />
        <CredentialField label="Verify Token" hint="You choose this — enter same value in Meta webhook config" value={verify} onChange={setVerify} editable={editable} />
      </div>
      {editable && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          {saved && <span className="text-xs text-green-600">Saved</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </Section>
  );
}

function FacebookCredentials({ cfg, clientId, editable, onSave }: { cfg: Record<string, unknown>; clientId: string; editable: boolean; onSave: (f: Record<string, unknown>) => Promise<void> }) {
  const [pageId, setPageId] = useState(String(cfg.page_id || ""));
  const [pageToken, setPageToken] = useState(String(cfg.page_access_token || ""));
  const [secret, setSecret] = useState(String(cfg.app_secret || ""));
  const [verify, setVerify] = useState(String(cfg.verify_token || ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    try {
      const fields: Record<string, unknown> = { page_id: pageId, verify_token: verify };
      if (pageToken && !pageToken.includes("•")) fields.page_access_token = pageToken;
      if (secret && !secret.includes("•")) fields.app_secret = secret;
      await onSave(fields); setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Section title="Facebook Messenger Credentials">
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
        <p className="font-semibold mb-1">Webhook URL — register in this client's Meta Developer Console:</p>
        <WebhookUrl url={`${BACKEND_URL}/api/integrations/${clientId}/facebook`} />
        <p className="mt-2">Each institution has a unique webhook URL.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CredentialField label="Facebook Page ID" hint="From your Page's About section" value={pageId} onChange={setPageId} editable={editable} />
        <CredentialField label="Page Access Token" hint="From Meta Developer Console" value={pageToken} onChange={setPageToken} secret editable={editable} />
        <CredentialField label="App Secret" hint="For signature verification" value={secret} onChange={setSecret} secret editable={editable} />
        <CredentialField label="Verify Token" hint="You choose this — enter same in Meta" value={verify} onChange={setVerify} editable={editable} />
      </div>
      {editable && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          {saved && <span className="text-xs text-green-600">Saved</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </Section>
  );
}

function TelegramCredentials({ cfg, clientId, editable, onSave }: { cfg: Record<string, unknown>; clientId: string; editable: boolean; onSave: (f: Record<string, unknown>) => Promise<void> }) {
  const [botToken, setBotToken] = useState(String(cfg.bot_token || ""));
  const [secretToken, setSecretToken] = useState(String(cfg.secret_token || ""));
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    try {
      const fields: Record<string, unknown> = { secret_token: secretToken };
      if (botToken && !botToken.includes("•")) fields.bot_token = botToken;
      await onSave(fields); setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function registerWebhook() {
    if (!webhookUrl) { setError("Enter your public backend URL first"); return; }
    setRegistering(true); setError("");
    try { await api.registerTelegramWebhook(clientId, webhookUrl); setRegistered(true); setTimeout(() => setRegistered(false), 4000); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setRegistering(false); }
  }

  return (
    <Section title="Telegram Bot Credentials">
      <p className="text-xs text-gray-500">Webhook URL: <code className="font-mono bg-gray-100 px-1">{BACKEND_URL}/api/integrations/{clientId}/telegram</code></p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CredentialField label="Bot Token" hint="From @BotFather" value={botToken} onChange={setBotToken} secret editable={editable} />
        <CredentialField label="Secret Token" hint="Optional — validates Telegram requests" value={secretToken} onChange={setSecretToken} secret editable={editable} />
      </div>
      {editable && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            {saved && <span className="text-xs text-green-600">Saved</span>}
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-800">Register Webhook with Telegram</p>
            <p className="text-xs text-gray-500">Enter your backend&apos;s public HTTPS URL (not localhost):</p>
            <div className="flex gap-2">
              <input className={`${inputCls} flex-1`} value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://api.yourdomain.com" />
              <button onClick={registerWebhook} disabled={registering} className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
                {registering ? "Registering…" : registered ? "Done!" : "Register"}
              </button>
            </div>
          </div>
        </>
      )}
    </Section>
  );
}

function SlackCredentials({ cfg, clientId, editable, onSave }: { cfg: Record<string, unknown>; clientId: string; editable: boolean; onSave: (f: Record<string, unknown>) => Promise<void> }) {
  const [botToken, setBotToken] = useState(String(cfg.bot_token || ""));
  const [signingSecret, setSigningSecret] = useState(String(cfg.signing_secret || ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    try {
      const fields: Record<string, unknown> = {};
      if (botToken && !botToken.includes("•")) fields.bot_token = botToken;
      if (signingSecret && !signingSecret.includes("•")) fields.signing_secret = signingSecret;
      await onSave(fields); setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Section title="Slack Bot Credentials">
      <div className="rounded-lg bg-violet-50 border border-violet-100 p-3 text-xs text-violet-800">
        <p className="font-semibold mb-1">Event Subscriptions URL:</p>
        <WebhookUrl url={`${BACKEND_URL}/api/integrations/${clientId}/slack`} />
        <p className="mt-2">Slack will verify the URL automatically — your backend handles the challenge.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CredentialField label="Bot Token (xoxb-…)" hint="From OAuth & Permissions" value={botToken} onChange={setBotToken} secret editable={editable} />
        <CredentialField label="Signing Secret" hint="From Basic Information" value={signingSecret} onChange={setSigningSecret} secret editable={editable} />
      </div>
      {editable && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          {saved && <span className="text-xs text-green-600">Saved</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </Section>
  );
}

function WidgetEmbedSection({ clientId, cfg }: { clientId: string; cfg: Record<string, unknown> }) {
  const origins = (cfg.allowed_origins as string[]) || [];
  const hasOriginLock = origins.length > 0;
  const frontendUrl = typeof window !== "undefined" ? window.location.origin.replace(":3000", ":8000") : BACKEND_URL;
  const embedCode = `<script\n  src="${frontendUrl}/widget/chatbot-widget.js"\n  data-client-id="${clientId}"\n></script>`;
  const [copied, setCopied] = useState(false);
  return (
    <Section title="Embed Code">
      <p className="text-sm text-gray-500">Paste this before <code>&lt;/body&gt;</code> on the institution&apos;s website:</p>

      {hasOriginLock ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800 space-y-1">
          <p className="font-semibold">Origin lock active — script is protected</p>
          <p>Only requests from the allowed domains below will be accepted. Copying this tag to another domain will be rejected server-side.</p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {origins.map(o => <li key={o} className="font-mono">{o}</li>)}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <p className="font-semibold">No origin lock — widget is open to any domain</p>
          <p>Add allowed origins above to prevent other websites from copying and using this widget.</p>
        </div>
      )}

      <div className="relative rounded-lg bg-gray-900 p-4">
        <pre className="text-xs text-gray-100 font-mono whitespace-pre overflow-x-auto">{embedCode}</pre>
        <button onClick={() => { navigator.clipboard.writeText(embedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="absolute right-3 top-3 rounded-md bg-gray-700 px-2.5 py-1.5 text-xs text-gray-200 hover:bg-gray-600">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Security is enforced via the <strong>Origin</strong> HTTP header — no secrets needed in the embed tag.
      </p>
    </Section>
  );
}

function CustomScriptSection({ clientId, editable }: { clientId: string; editable: boolean }) {
  const [customScript, setCustomScript] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getClientConfig(clientId).then(config => {
      if (config?.settings?.custom_widget_script !== undefined) {
        setCustomScript(config.settings.custom_widget_script || "");
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [clientId]);

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      await api.updateClientSettings(clientId, { custom_widget_script: customScript });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save script");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Custom Widget Script">
      <p className="text-xs text-gray-500">
        Edit the raw custom JavaScript for this institution. This overrides the standard widget behaviour and allows custom integrations.
      </p>
      {loading ? (
        <div className="h-24 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <textarea
            value={customScript}
            onChange={(e) => setCustomScript(e.target.value)}
            disabled={!editable}
            className="w-full h-80 font-mono text-xs border border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:outline-none"
            placeholder="// Paste or edit custom widget script here..."
            spellCheck={false}
          />
          {editable && (
            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Custom Script"}
              </button>
              {saved && <span className="text-xs text-green-600 font-semibold">Custom script saved successfully!</span>}
              {error && <span className="text-xs text-red-600">{error}</span>}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

// ── Main setup page ────────────────────────────────────────────────────────────

export default function SetupConfigPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const setupChannel = params.setup as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupData, setSetupData] = useState<{ channel: string; label: string; emoji: string; config: Record<string, unknown>; editable: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getSetupConfig(clientId, setupChannel);
      setSetupData(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }, [clientId, setupChannel]);

  useEffect(() => { load(); }, [load]);

  async function saveConfig(fields: Record<string, unknown>) {
    await api.updateSetupConfig(clientId, setupChannel, fields);
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );

  if (error || !setupData) return (
    <div className="space-y-4">
      <Link href={`/dashboard/super-admin/institutions/${clientId}`} className="text-sm text-blue-600 hover:underline">&larr; Back to institution</Link>
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error || "Setup not found"}</div>
    </div>
  );

  const { config: cfg, editable } = setupData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/super-admin/institutions/${clientId}`} className="text-sm text-blue-600 hover:underline">&larr; {clientId}</Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{setupData.emoji}</span>
            <h1 className="text-xl font-bold text-gray-900">{setupData.label}</h1>
          </div>
          <p className="text-xs text-gray-400">Setup Configuration{!editable ? " · Read-only" : ""}</p>
        </div>
        {/* Quick analytics link */}
        <Link href={`/dashboard/super-admin/institutions/${clientId}/analytics?channel=${setupChannel}`}
          className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          📈 View Analytics
        </Link>
      </div>

      {!editable && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
          You have read-only access to this setup configuration.
        </div>
      )}

      {/* Rate limits — all setups */}
      <RateLimitsSection cfg={cfg} editable={editable} onSave={saveConfig} />

      {/* Context-Adaptive RAG & Context Carrying — all setups */}
      <ContextAdaptiveRAGSection cfg={cfg} editable={editable} onSave={saveConfig} />

      {/* API Key security — web_api only (widget uses Origin lock, not token) */}
      {setupChannel === "web_api" && (
        <TokenSection cfg={cfg} channel={setupChannel} clientId={clientId} editable={editable} />
      )}

      {/* Allowed origins — widget only */}
      {setupChannel === "widget" && (
        <OriginsSection cfg={cfg} clientId={clientId} channel={setupChannel} editable={editable} onSave={saveConfig} />
      )}

      {/* Widget embed code */}
      {setupChannel === "widget" && (
        <>
          <WidgetEmbedSection clientId={clientId} cfg={cfg} />
          <CustomScriptSection clientId={clientId} editable={editable} />
        </>
      )}

      {/* Channel-specific credentials */}
      {setupChannel === "whatsapp" && (
        <>
          <WhatsAppCredentials cfg={cfg} clientId={clientId} editable={editable} onSave={saveConfig} />
          <CustomScriptSection clientId={clientId} editable={editable} />
        </>
      )}
      {setupChannel === "facebook" && <FacebookCredentials cfg={cfg} clientId={clientId} editable={editable} onSave={saveConfig} />}
      {setupChannel === "telegram" && <TelegramCredentials cfg={cfg} clientId={clientId} editable={editable} onSave={saveConfig} />}
      {setupChannel === "slack" && <SlackCredentials cfg={cfg} clientId={clientId} editable={editable} onSave={saveConfig} />}
    </div>
  );
}
