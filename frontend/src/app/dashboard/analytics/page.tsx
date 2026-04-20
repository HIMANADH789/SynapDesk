"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UsageStats, ChannelStats, QueryLog } from "@/types";

const CHANNEL_META: Record<string, { label: string; emoji: string; color: string }> = {
  widget:   { label: "Website Widget", emoji: "🌐", color: "bg-blue-500" },
  web_api:  { label: "REST API",       emoji: "⚡", color: "bg-purple-500" },
  whatsapp: { label: "WhatsApp",       emoji: "💬", color: "bg-green-500" },
  facebook: { label: "Facebook",       emoji: "💙", color: "bg-blue-400" },
  telegram: { label: "Telegram",       emoji: "✈️", color: "bg-sky-500" },
  slack:    { label: "Slack",          emoji: "🟣", color: "bg-violet-500" },
};

function ChannelDetailView({ channel }: { channel: string }) {
  const [data, setData] = useState<ChannelStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getChannelUsage(channel).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [channel]);

  if (loading) return <div className="flex h-24 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  if (!data) return <p className="text-sm text-red-500">Failed to load</p>;

  const max = Math.max(...(data.daily_trend.map(d => d.count)), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Queries", value: data.total_queries.toLocaleString() },
          { label: "Today", value: data.queries_today.toLocaleString() },
          { label: "Avg Response", value: `${data.avg_response_time_ms}ms` },
          { label: "Cache Hits", value: data.cache_hits.toLocaleString() },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      {data.daily_trend.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Daily Queries (14 days)</h3>
          <div className="flex items-end gap-1 h-20">
            {data.daily_trend.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full rounded-t-sm bg-blue-400" style={{ height: `${(d.count / max) * 64}px`, minHeight: d.count ? 2 : 0 }} title={`${d.date}: ${d.count}`} />
                <span className="text-[9px] text-gray-400">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.top_queries.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Top Questions</h3>
          <div className="space-y-1.5">
            {data.top_queries.map((q, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                <span className="text-gray-700 truncate">{q.query}</span>
                <span className="ml-2 shrink-0 font-semibold text-gray-500">{q.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  useEffect(() => { api.getUsage().then(setStats).catch(console.error); }, []);
  useEffect(() => { api.getQueries(page).then(r => { setLogs(r.logs); setTotal(r.total); }).catch(console.error); }, [page]);

  const activeChannels = stats?.channel_breakdown.filter(c => c.total_queries > 0) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* Overview cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Queries", value: stats.total_queries },
            { label: "Today", value: stats.queries_today },
            { label: "Avg Response", value: `${stats.avg_response_time_ms}ms` },
            { label: "LLM Quota Left", value: stats.remaining_llm_quota },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{typeof c.value === "number" ? c.value.toLocaleString() : c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Channel breakdown overview */}
      {stats && stats.channel_breakdown.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Usage by Setup</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.channel_breakdown.map(ch => {
              const meta = CHANNEL_META[ch.channel] || { label: ch.channel, emoji: "❓", color: "bg-gray-400" };
              return (
                <button key={ch.channel} onClick={() => setActiveChannel(activeChannel === ch.channel ? null : ch.channel)}
                  className={`rounded-xl border p-3 text-center transition-colors ${activeChannel === ch.channel ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"} ${ch.total_queries === 0 ? "opacity-40" : ""}`}>
                  <p className="text-xl">{meta.emoji}</p>
                  <p className="mt-1 text-xs font-medium text-gray-700">{meta.label}</p>
                  <p className="text-lg font-bold text-gray-900">{ch.total_queries.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{ch.avg_response_time_ms}ms avg</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-channel detail */}
      {activeChannel && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">{CHANNEL_META[activeChannel]?.emoji || "❓"}</span>
            <h2 className="text-base font-semibold text-gray-900">{CHANNEL_META[activeChannel]?.label || activeChannel} — Detail</h2>
            <button onClick={() => setActiveChannel(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          <ChannelDetailView channel={activeChannel} />
        </div>
      )}

      {/* Query log */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Recent Queries</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {logs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">No queries yet.</p>
          ) : logs.map((log, i) => (
            <div key={i} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {log.channel && <span className="text-xs">{CHANNEL_META[log.channel]?.emoji || "❓"}</span>}
                    {log.cache_hit && <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">cache</span>}
                    <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{log.query}</p>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">{log.response}</p>
                </div>
                <div className="text-right text-xs text-gray-400 shrink-0">
                  <p>{log.response_time_ms}ms</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {total > 20 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <p className="text-xs text-gray-500">{total} total</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs disabled:opacity-40">Prev</button>
              <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
