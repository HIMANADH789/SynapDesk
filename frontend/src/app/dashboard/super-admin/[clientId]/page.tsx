"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SuperAdminClientDetail } from "@/types";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function InstitutionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.clientId as string;
  const { role } = useAuth();

  const [data, setData] = useState<SuperAdminClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [setups, setSetups] = useState<any[]>([]);

  useEffect(() => {
    if (role && role !== "super_admin") {
      router.replace("/dashboard");
    }
  }, [role, router]);

  useEffect(() => {
    if (role !== "super_admin") return;
    setLoading(true);
    api.superAdminClientDetail(clientId, page)
      .then((stats) => {
        setData(stats);
        if (page === 1) {
          api.listSetups(clientId).then(res => setSetups(res.setups)).catch(() => {});
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId, page, role]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (!data) return null;

  const totalPages = Math.ceil(data.logs_total / data.logs_page_size);

  async function toggleSetup(channel: string, currentStatus: boolean) {
    try {
      await api.toggleSetup(clientId, channel, !currentStatus);
      // Refresh setups
      const res = await api.listSetups(clientId);
      setSetups(res.setups);
    } catch (e: any) {
      alert("Failed to toggle: " + e.message);
    }
  }

  async function saveLimits(channel: string, rpm: number, rpd: number) {
    try {
      await api.updateSetupConfig(clientId, channel, { rate_limit_rpm: rpm, rate_limit_rpd: rpd });
      alert(`Limits saved for ${channel}`);
    } catch (e: any) {
      alert("Failed to save limits: " + e.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/super-admin"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        ← All Institutions
      </Link>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{clientId}</h1>
        <p className="text-sm text-gray-500">Institution usage details</p>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Queries" value={data.total_queries} />
        <StatCard label="Queries Today" value={data.queries_today} />
        <StatCard label="Avg Response Time" value={`${data.avg_response_time_ms} ms`} />
        <StatCard label="Documents" value={data.document_count} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Input Tokens" value={data.total_input_tokens} />
        <StatCard label="Total Output Tokens" value={data.total_output_tokens} />
        <StatCard
          label="Total Tokens"
          value={data.total_input_tokens + data.total_output_tokens}
          sub="input + output"
        />
      </div>

      {/* LLM provider breakdown */}
      {!!(data as unknown as Record<string, unknown[]>).provider_breakdown?.length && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800">LLM Provider Usage</h2>
          <div className="flex flex-wrap gap-3">
            {((data as unknown as Record<string, unknown[]>).provider_breakdown as { provider: string; count: number }[] ?? []).map((p) => (
              <div
                key={p.provider}
                className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <span className="text-sm font-medium text-gray-700">{p.provider}</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {p.count} queries
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top queries */}
      {data.top_queries.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800">Top Questions</h2>
          <ol className="space-y-2">
            {data.top_queries.map((q, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-gray-700">{q.query}</span>
                <span className="shrink-0 text-xs text-gray-400">{q.count}x</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Query logs */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="font-semibold text-gray-800">Query Log</h2>
          <span className="text-xs text-gray-400">{data.logs_total} total</span>
        </div>
        <div className="divide-y divide-gray-50">
          {data.logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No queries yet</p>
          ) : (
            data.logs.map((log, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800">{log.query}</p>
                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{log.response}</p>
                <div className="mt-1.5 flex gap-3 text-xs text-gray-400">
                  <span>{log.response_time_ms} ms</span>
                  <span>{log.llm_provider}</span>
                  {log.sources.length > 0 && <span>{log.sources.length} source(s)</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Channel Features & Limits */}
      {setups.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 mt-6">
          <h2 className="mb-2 font-semibold text-gray-800">Channel Features &amp; Limits</h2>
          <p className="mb-4 text-sm text-gray-500">Enable/disable integrations and set rate limits for this institution.</p>
          <div className="space-y-4">
            {setups.map((setup, idx) => (
              <div key={setup.channel} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-gray-100 rounded-lg bg-gray-50/50">
                <div className="flex items-center gap-3 w-1/4">
                  <span className="text-xl">{setup.emoji}</span>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{setup.label}</p>
                    <p className="text-xs text-gray-500">{setup.channel}</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-500 mb-1">Req / min</label>
                    <input 
                      type="number"
                      className="border border-gray-200 rounded px-2 py-1 text-sm w-20"
                      value={setup.rate_limit_rpm}
                      onChange={(e) => {
                        const newSetups = [...setups];
                        newSetups[idx].rate_limit_rpm = parseInt(e.target.value) || 0;
                        setSetups(newSetups);
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-500 mb-1">Req / day</label>
                    <input 
                      type="number"
                      className="border border-gray-200 rounded px-2 py-1 text-sm w-24"
                      value={setup.rate_limit_rpd}
                      onChange={(e) => {
                        const newSetups = [...setups];
                        newSetups[idx].rate_limit_rpd = parseInt(e.target.value) || 0;
                        setSetups(newSetups);
                      }}
                    />
                  </div>
                  <div className="flex flex-col mt-4 sm:mt-0">
                    <button
                      onClick={() => saveLimits(setup.channel, setup.rate_limit_rpm, setup.rate_limit_rpd)}
                      className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded font-medium"
                    >
                      Save Limits
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-1/4 justify-end">
                  <button
                    onClick={() => toggleSetup(setup.channel, setup.enabled)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      setup.enabled 
                        ? "bg-green-100 text-green-700 hover:bg-green-200" 
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                  >
                    {setup.enabled ? "ENABLED" : "DISABLED"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
