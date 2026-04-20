"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ChannelStats, SetupSummary } from "@/types";

const CHANNEL_EMOJIS: Record<string, string> = {
  widget: "🌐", web_api: "⚡", whatsapp: "💬", facebook: "💙", telegram: "✈️", slack: "🟣",
};
const CHANNEL_LABELS: Record<string, string> = {
  widget: "Website Widget", web_api: "REST API", whatsapp: "WhatsApp", facebook: "Facebook", telegram: "Telegram", slack: "Slack",
};

function StatCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function DailyTrendChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <p className="text-sm text-gray-400">No data yet.</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map(d => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full rounded-t-sm bg-blue-400" style={{ height: `${(d.count / max) * 80}px`, minHeight: d.count ? 2 : 0 }} title={`${d.date}: ${d.count}`} />
          <span className="text-[9px] text-gray-400 rotate-45 origin-left mt-1">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function ChannelDetailView({ clientId, channel }: { clientId: string; channel: string }) {
  const [data, setData] = useState<ChannelStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.superAdminChannelDetail(clientId, channel).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [clientId, channel]);

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  if (!data) return <p className="text-sm text-red-500">Failed to load channel data</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Total Queries" value={data.total_queries} />
        <StatCard title="Queries Today" value={data.queries_today} />
        <StatCard title="Avg Response" value={`${data.avg_response_time_ms}ms`} />
        <StatCard title="Cache Hits" value={data.cache_hits} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Daily Trend (14 days)</h3>
          <DailyTrendChart data={data.daily_trend} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Top Questions</h3>
          {data.top_queries.length === 0 ? <p className="text-sm text-gray-400">No queries yet.</p> : (
            <div className="space-y-1.5">
              {data.top_queries.slice(0, 8).map((q, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                  <span className="text-gray-700 truncate max-w-[200px]">{q.query}</span>
                  <span className="ml-2 shrink-0 font-semibold text-gray-500">{q.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Tokens Used</h3>
        <div className="flex gap-6 text-sm">
          <div><span className="text-gray-500">Input:</span> <strong>{data.input_tokens.toLocaleString()}</strong></div>
          <div><span className="text-gray-500">Output:</span> <strong>{data.output_tokens.toLocaleString()}</strong></div>
        </div>
      </div>
    </div>
  );
}

export default function InstitutionAnalyticsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;
  const defaultChannel = searchParams.get("channel") || null;

  const [setups, setSetups] = useState<SetupSummary[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(defaultChannel);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.listSetups(clientId);
      const enabled = data.setups.filter(s => s.enabled);
      setSetups(enabled);
      if (!activeChannel && enabled.length > 0) setActiveChannel(enabled[0].channel);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId, activeChannel]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/super-admin/institutions/${clientId}`} className="text-sm text-blue-600 hover:underline">&larr; {clientId}</Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-xs text-gray-400">Per-setup usage breakdown</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>
      ) : (
        <>
          {/* Setup tabs */}
          <div className="flex flex-wrap gap-2">
            {setups.map(s => (
              <button key={s.channel}
                onClick={() => setActiveChannel(s.channel)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${activeChannel === s.channel ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                <span>{s.emoji}</span>{s.label}
              </button>
            ))}
          </div>

          {/* Active channel detail */}
          {activeChannel ? (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xl">{CHANNEL_EMOJIS[activeChannel]}</span>
                <h2 className="text-base font-semibold text-gray-900">{CHANNEL_LABELS[activeChannel] || activeChannel}</h2>
                <Link href={`/dashboard/super-admin/institutions/${clientId}/setups/${activeChannel}`}
                  className="ml-auto text-xs text-blue-600 hover:underline">Configure →</Link>
              </div>
              <ChannelDetailView clientId={clientId} channel={activeChannel} />
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No active setups. Activate a setup to see analytics.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
