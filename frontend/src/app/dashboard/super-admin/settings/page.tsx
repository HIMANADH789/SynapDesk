"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type MasterKey = { key_id: string; name: string; created_at: string };
type NewKeyResult = { key_id: string; name: string; value: string };

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function SuperAdminSettingsPage() {
  const router = useRouter();
  const { role } = useAuth();

  const [keys, setKeys] = useState<MasterKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Newly created key — shown once
  const [newKeyResult, setNewKeyResult] = useState<NewKeyResult | null>(null);
  const [valueCopied, setValueCopied] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (role && role !== "super_admin") { router.replace("/dashboard"); return; }
    if (role === "super_admin") loadKeys();
  }, [role, router]);

  async function loadKeys() {
    try {
      const res = await api.listMasterKeys();
      setKeys(res.keys);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!name.trim()) { setCreateError("Key name is required."); return; }
    if (value.length < 8) { setCreateError("Value must be at least 8 characters."); return; }
    if (value !== confirmValue) { setCreateError("Values do not match."); return; }
    setCreating(true);
    try {
      const res = await api.createMasterKey(name.trim(), value);
      setNewKeyResult(res);
      setKeys((prev) => [...prev, { key_id: res.key_id, name: res.name, created_at: new Date().toISOString() }]);
      setName(""); setValue(""); setConfirmValue("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create key.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(keyId: string) {
    if (!confirm("Delete this master key? Any copy of its value will no longer work for impersonation.")) return;
    setDeletingId(keyId);
    try {
      await api.deleteMasterKey(keyId);
      setKeys((prev) => prev.filter((k) => k.key_id !== keyId));
      if (newKeyResult?.key_id === keyId) setNewKeyResult(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  function copyValue() {
    if (newKeyResult) {
      navigator.clipboard.writeText(newKeyResult.value);
      setValueCopied(true);
      setTimeout(() => setValueCopied(false), 2000);
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Super Admin Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Platform-level security configuration</p>
      </div>

      {/* Master Keys Section */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Master Gateway Keys</h2>
          <p className="mt-1 text-xs text-gray-500">
            Master keys let you log into any institution admin portal via "Login As" in Manage Institutions.
            Multiple named keys can exist — any valid key works. Delete a key to revoke it permanently.
          </p>
        </div>

        <div className="p-6 space-y-6">

          {/* Security info */}
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-xs text-amber-800 space-y-1.5">
            <p><strong>How it works:</strong> When you click "Login As" on any institution, you enter a master key value. If it matches any active key, you get a 1-hour admin session for that institution.</p>
            <p><strong>Security:</strong> Values are bcrypt-hashed — even if the database is read, the plaintext cannot be recovered.</p>
            <p><strong>The value is shown only once</strong> at creation. Losing it requires deleting and creating a new key.</p>
          </div>

          {/* Newly created key — one-time display */}
          {newKeyResult && (
            <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-200 px-2 py-0.5 text-xs font-bold text-green-800">NEW KEY CREATED</span>
                <span className="text-sm font-semibold text-green-800">{newKeyResult.name}</span>
              </div>
              <p className="text-xs text-green-700 font-medium">Copy this value now — it will never be shown again:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-white border border-green-200 px-3 py-2.5 text-sm font-mono text-gray-900 break-all">
                  {newKeyResult.value}
                </code>
                <button
                  onClick={copyValue}
                  className="shrink-0 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                >
                  {valueCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button
                onClick={() => setNewKeyResult(null)}
                className="text-xs text-green-600 hover:underline"
              >
                I have copied it, dismiss
              </button>
            </div>
          )}

          {/* Active keys list */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-800">
              Active Keys <span className="text-gray-400 font-normal">({keys.length})</span>
            </h3>

            {keys.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                No master keys yet. Create one below to enable the "Login As" feature.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {keys.map((k) => (
                  <div key={k.key_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{k.name}</p>
                      <p className="text-xs text-gray-400">
                        Created {new Date(k.created_at).toLocaleDateString()} · ID: <code className="font-mono">{k.key_id.slice(0, 8)}…</code>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
                      <button
                        onClick={() => handleDelete(k.key_id)}
                        disabled={deletingId === k.key_id}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === k.key_id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create new key form */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Create New Key</h3>

            {createError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{createError}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Key Name</label>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production Key, On-call Key"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Key Value</label>
                <p className="mb-1 text-xs text-gray-400">Min. 8 characters. Use a strong, random value.</p>
                <div className="relative">
                  <input
                    type={showValue ? "text" : "password"}
                    className={`${inputCls} pr-16 font-mono`}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Enter a strong secret value"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue((v) => !v)}
                    className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {showValue ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Confirm Value</label>
                <input
                  type="password"
                  className={`${inputCls} font-mono`}
                  value={confirmValue}
                  onChange={(e) => setConfirmValue(e.target.value)}
                  placeholder="Repeat the value"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create Key"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
