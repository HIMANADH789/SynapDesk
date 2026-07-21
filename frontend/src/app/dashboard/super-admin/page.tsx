"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SuperAdminOverview, ClientUsageSummary } from "@/types";

import { getKeeperStatus, toggleKeeper } from "@/actions/cron";

function KeeperToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getKeeperStatus().then((res) => {
      setEnabled(res.enabled);
      setConfigured(res.configured);
      setLoading(false);
    }).catch(e => {
      setError("Failed to fetch status");
      setLoading(false);
    });
  }, []);

  const handleToggle = async () => {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      const res = await toggleKeeper(!enabled);
      setEnabled(res.enabled);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !configured) {
    return <div className="text-sm text-gray-500">Checking keeper status...</div>;
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
        <h3 className="font-semibold text-yellow-800">Backend Keeper (Not Configured)</h3>
        <p className="text-sm text-yellow-700 mt-1">
          Missing CRON_JOB_API_KEY or CRON_JOB_ID in Vercel environment variables.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-gray-900">Keep Backend Awake</h3>
        <p className="text-sm text-gray-500 mt-1">
          When ON, the Cron-Job.org job pings Render every 10 mins to prevent cold starts.
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
          enabled ? "bg-blue-600" : "bg-gray-200"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
}

function InstitutionRow({ client }: { client: ClientUsageSummary }) {
  const totalTokens = client.total_input_tokens + client.total_output_tokens;
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4">
        <div className="font-medium text-gray-900">{client.name}</div>
        <div className="text-xs text-gray-400">{client.client_id}</div>
      </td>
      <td className="py-3 px-4 text-right text-sm text-gray-700">{client.total_queries.toLocaleString()}</td>
      <td className="py-3 px-4 text-right text-sm text-gray-700">{client.queries_this_month.toLocaleString()}</td>
      <td className="py-3 px-4 text-right text-sm text-gray-700">{client.queries_today.toLocaleString()}</td>
      <td className="py-3 px-4 text-right text-sm text-gray-700">{client.avg_response_time_ms} ms</td>
      <td className="py-3 px-4 text-right text-sm text-gray-700">{totalTokens.toLocaleString()}</td>
      <td className="py-3 px-4 text-right text-sm text-gray-700">{client.document_count}</td>
      <td className="py-3 px-4 text-right">
        <Link
          href={`/dashboard/super-admin/${client.client_id}`}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          View details
        </Link>
      </td>
    </tr>
  );
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [data, setData] = useState<SuperAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role && role !== "super_admin") {
      router.replace("/dashboard");
      return;
    }
    if (role === "super_admin") {
      api
        .superAdminOverview()
        .then(setData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [role, router]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
    );
  }

  if (!data) return null;

  const platformTotalTokens =
    data.platform_total_input_tokens + data.platform_total_output_tokens;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">All Institutions</h1>
        <p className="text-sm text-gray-500">
          Platform-wide usage across {data.total_clients} institution
          {data.total_clients !== 1 ? "s" : ""}
        </p>
      </div>

      <KeeperToggle />

      {/* Platform-level stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Institutions" value={data.total_clients} />
        <StatCard label="Platform Total Queries" value={data.platform_total_queries} />
        <StatCard label="Total Input Tokens" value={data.platform_total_input_tokens} />
        <StatCard label="Total Output Tokens" value={data.platform_total_output_tokens} />
      </div>

      {/* Per-institution table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="font-semibold text-gray-800">Institution Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="py-3 px-4 text-left font-medium">Institution</th>
                <th className="py-3 px-4 text-right font-medium">Total Queries</th>
                <th className="py-3 px-4 text-right font-medium">This Month</th>
                <th className="py-3 px-4 text-right font-medium">Today</th>
                <th className="py-3 px-4 text-right font-medium">Avg Response</th>
                <th className="py-3 px-4 text-right font-medium">Total Tokens</th>
                <th className="py-3 px-4 text-right font-medium">Docs</th>
                <th className="py-3 px-4 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {data.clients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    No institutions found
                  </td>
                </tr>
              ) : (
                data.clients.map((client) => (
                  <InstitutionRow key={client.client_id} client={client} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
