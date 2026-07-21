"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ClientRecord } from "@/types";

// ── Reusable input ────────────────────────────────────────────────────────────
function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="mb-1 text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// ── Create Institution Modal ──────────────────────────────────────────────────
function CreateInstitutionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: ClientRecord) => void }) {
  const [form, setForm] = useState({
    client_id: "",
    name: "",
    domain: "",
    admin_email: "",
    admin_password: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setStr(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setForm((f) => ({ ...f, name, client_id: id }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.client_id || !form.name) { setError("Name and ID are required."); return; }
    setLoading(true);
    try {
      await api.createClient({
        client_id: form.client_id,
        name: form.name,
        domain: form.domain,
        admin_email: form.admin_email || undefined,
        admin_password: form.admin_password || undefined,
      });
      onCreated({
        client_id: form.client_id,
        name: form.name,
        domain: form.domain,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create institution.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">New Institution</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {/* Basic Info */}
          <div className="space-y-4">
            <Field label="Institution Name" hint="Full name, e.g. Demo Engineering College">
              <input className={inputCls} value={form.name} onChange={handleNameChange}
                placeholder="Demo Engineering College" required />
            </Field>

            <Field label="Client ID" hint="Auto-generated. Used in the widget embed code — no spaces.">
              <input className={`${inputCls} font-mono`} value={form.client_id}
                onChange={setStr("client_id")} placeholder="demo-engineering-college" required />
            </Field>

            <Field label="Domain (optional)" hint="Institution website, e.g. democollege.edu">
              <input className={inputCls} value={form.domain} onChange={setStr("domain")}
                placeholder="democollege.edu" />
            </Field>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Admin Account (Optional)</h3>
              <div className="space-y-4">
                <Field label="Admin Email">
                  <input type="email" className={inputCls} value={form.admin_email} onChange={setStr("admin_email")}
                    placeholder="admin@democollege.edu" />
                </Field>
                <Field label="Admin Password" hint="Min. 8 characters if provided">
                  <input type="password" className={inputCls} value={form.admin_password} onChange={setStr("admin_password")}
                    placeholder="••••••••" />
                </Field>
              </div>
            </div>
          </div>

          {/* Advanced Settings (collapsible) */}
          <div className="rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              <span>Advanced Settings</span>
              <span className="text-gray-400">{showAdvanced ? "▲" : "▼"}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
                <p className="text-xs text-gray-500">
                  Rate limits and session settings are configured per-channel after creation.
                  Navigate to the institution → setup → configure.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Creating..." : "Create Institution"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Create Admin Modal ────────────────────────────────────────────────────────
function CreateAdminModal({ client, onClose, onCreated }: { client: ClientRecord; onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      await api.register(email, password, client.client_id, "admin");
      setSuccess(true);
      setTimeout(() => { onCreated(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create admin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Create Admin</h2>
            <p className="text-xs text-gray-400">{client.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          {success && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">Admin created successfully!</div>}

          <Field label="Admin Email">
            <input type="email" className={inputCls} value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`admin@${client.domain || "institution.edu"}`} required />
          </Field>

          <Field label="Password" hint="Min. 8 characters">
            <input type="password" className={inputCls} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </Field>

          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
            This admin will have access to <strong>{client.name}</strong>&apos;s documents,
            chat test, analytics, and settings.
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || success}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {loading ? "Creating..." : "Create Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Login As Modal ────────────────────────────────────────────────────────────
function LoginAsModal({ client, onClose }: { client: ClientRecord; onClose: () => void }) {
  const router = useRouter();
  const [masterKey, setMasterKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.impersonate(client.client_id, masterKey);
      // Save current super admin token
      const currentToken = localStorage.getItem("token");
      if (currentToken) sessionStorage.setItem("super_admin_token", currentToken);
      // Save impersonation metadata
      sessionStorage.setItem("impersonation", JSON.stringify({
        name: res.institution_name,
        clientId: res.client_id,
      }));
      // Switch to institution token — use full reload so AuthContext re-reads localStorage
      localStorage.setItem("token", res.access_token);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to impersonate.");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Login As Institution Admin</h2>
            <p className="text-xs text-gray-400">{client.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
            You will be redirected to the admin dashboard of <strong>{client.name}</strong>.
            Enter your master key to proceed.
          </div>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Master Key</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:border-blue-500 focus:outline-none"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="Enter master key"
                autoFocus
                required
              />
              <button type="button" onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-2 text-xs text-gray-400">{showKey ? "Hide" : "Show"}</button>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {loading ? "Verifying\u2026" : "Login As Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Institution Row ───────────────────────────────────────────────────────────
function InstitutionRow({
  client,
  onCreateAdmin,
  onLoginAs,
}: {
  client: ClientRecord;
  onCreateAdmin: (c: ClientRecord) => void;
  onLoginAs: (c: ClientRecord) => void;
}) {
  const widgetSetup = client.settings?.setups?.widget as Record<string, unknown> | undefined;
  const rpm = (widgetSetup?.rate_limit_rpm as number) ?? 20;
  const rpd = (widgetSetup?.rate_limit_rpd as number) ?? 200;
  const sessionLimit = (widgetSetup?.max_queries_per_session as number) ?? 50;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4">
        <p className="font-medium text-gray-900">{client.name}</p>
        <p className="text-xs font-mono text-gray-400">{client.client_id}</p>
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">{client.domain || "—"}</td>
      <td className="py-3 px-4">
        <div className="text-xs text-gray-600">
          <span className={rpm === 0 ? "text-amber-600" : ""}>{rpm === 0 ? "Unlimited" : `${rpm}/min`}</span>
          <span className="mx-1 text-gray-300">/</span>
          <span className={rpd === 0 ? "text-amber-600" : ""}>{rpd === 0 ? "Unlimited" : `${rpd}/day`}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs ${sessionLimit === 0 ? "text-amber-600" : "text-gray-600"}`}>
          {sessionLimit === 0 ? "Unlimited" : `${sessionLimit} msgs`}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-gray-400">
        {client.created_at ? new Date(client.created_at).toLocaleDateString() : "—"}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/dashboard/super-admin/institutions/${client.client_id}`}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            Configure
          </Link>
          <button
            onClick={() => onCreateAdmin(client)}
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            + Admin
          </button>
          <button
            onClick={() => onLoginAs(client)}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
          >
            Login As
          </button>
          <Link
            href={`/dashboard/super-admin/${client.client_id}`}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Usage
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InstitutionsPage() {
  const router = useRouter();
  const { role } = useAuth();

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [adminTarget, setAdminTarget] = useState<ClientRecord | null>(null);
  const [loginAsTarget, setLoginAsTarget] = useState<ClientRecord | null>(null);

  useEffect(() => {
    if (role && role !== "super_admin") { router.replace("/dashboard"); return; }
    if (role === "super_admin") loadClients();
  }, [role, router]);

  async function loadClients() {
    try {
      const res = await api.listClients();
      setClients(res.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load institutions.");
    } finally {
      setLoading(false);
    }
  }

  function handleCreated(c: ClientRecord) {
    setClients((prev) => [c, ...prev]);
    setShowCreate(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {showCreate && (
        <CreateInstitutionModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {adminTarget && (
        <CreateAdminModal
          client={adminTarget}
          onClose={() => setAdminTarget(null)}
          onCreated={() => {}}
        />
      )}
      {loginAsTarget && (
        <LoginAsModal
          client={loginAsTarget}
          onClose={() => setLoginAsTarget(null)}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Manage Institutions</h1>
            <p className="text-sm text-gray-500">{clients.length} institution{clients.length !== 1 ? "s" : ""} registered</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Institution
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="font-medium text-gray-700">No institutions yet</p>
              <p className="text-sm text-gray-400">Click &quot;New Institution&quot; to create your first one.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Institution
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                    <th className="py-3 px-4 text-left font-medium">Institution</th>
                    <th className="py-3 px-4 text-left font-medium">Domain</th>
                    <th className="py-3 px-4 text-left font-medium">Rate Limits (rpm/rpd)</th>
                    <th className="py-3 px-4 text-left font-medium">Session Limit</th>
                    <th className="py-3 px-4 text-left font-medium">Created</th>
                    <th className="py-3 px-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <InstitutionRow
                      key={c.client_id}
                      client={c}
                      onCreateAdmin={setAdminTarget}
                      onLoginAs={setLoginAsTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h3 className="mb-2 text-sm font-semibold text-blue-800">How institutions work</h3>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-blue-700">
            <li>Create an institution — set a name, Client ID, and optional rate limits</li>
            <li>Add an admin account for that institution using &quot;+ Admin&quot;</li>
            <li>The admin logs in and uploads documents, configures settings</li>
            <li>Click &quot;Configure&quot; to manage rate limits, widget security, and chat behavior</li>
            <li>Institution website embeds the widget using their Client ID</li>
            <li>View usage and token consumption in the &quot;Usage&quot; drill-down</li>
          </ol>
        </div>
      </div>
    </>
  );
}
