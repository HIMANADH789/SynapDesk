"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { WebhookLog } from "@/types";

const CHANNEL_INFO: Record<string, { label: string; emoji: string; badgeColor: string }> = {
  whatsapp: { label: "WhatsApp", emoji: "💬", badgeColor: "bg-green-100 text-green-800 border-green-200" },
  widget:   { label: "Website Widget", emoji: "🌐", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  web_api:  { label: "REST API", emoji: "⚡", badgeColor: "bg-purple-100 text-purple-800 border-purple-200" },
  facebook: { label: "Facebook", emoji: "💙", badgeColor: "bg-sky-100 text-sky-800 border-sky-200" },
  telegram: { label: "Telegram", emoji: "✈️", badgeColor: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  slack:    { label: "Slack", emoji: "🟣", badgeColor: "bg-violet-100 text-violet-800 border-violet-200" },
};

function getStatusBadge(status: string) {
  if (status === "response_sent" || status === "delivered" || status === "ok") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">● Replied</span>;
  }
  if (status.startsWith("receipt_")) {
    const sub = status.replace("receipt_", "");
    return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-200">✓ {sub}</span>;
  }
  if (status === "message_received") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">📥 Inbound</span>;
  }
  if (status.includes("error") || status.includes("failed")) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 border border-red-200">⚠️ Error</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 border border-gray-200">{status}</span>;
}

export default function RequestLogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "raw" | "outgoing" | "error">("overview");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filters
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10); // in seconds (0 = off)

  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await api.getWebhookLogs({
        page,
        pageSize: 25,
        channel: channelFilter !== "all" ? channelFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to load webhook logs:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [page, channelFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      fetchLogs(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchLogs]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request &amp; Webhook Logs</h1>
          <p className="text-sm text-gray-500">
            Real-time inspection of incoming messages, Meta WhatsApp webhooks, responses, and raw JSON payloads.
          </p>
        </div>

        {/* Live Refresh Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm text-xs">
            <span className={`h-2 w-2 rounded-full ${autoRefreshInterval > 0 ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
            <span className="text-gray-600 font-medium">Auto-refresh:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent font-semibold text-blue-600 focus:outline-none cursor-pointer"
            >
              <option value={0}>Off</option>
              <option value={5}>Every 5s</option>
              <option value={10}>Every 10s</option>
              <option value={30}>Every 30s</option>
            </select>
          </div>

          <button
            onClick={() => fetchLogs()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Channel Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 bg-gray-50 text-xs font-medium">
            <button
              onClick={() => { setChannelFilter("all"); setPage(1); }}
              className={`rounded-md px-2.5 py-1 transition-colors ${channelFilter === "all" ? "bg-white text-blue-600 shadow-sm font-semibold" : "text-gray-600 hover:text-gray-900"}`}
            >
              All Channels
            </button>
            <button
              onClick={() => { setChannelFilter("whatsapp"); setPage(1); }}
              className={`rounded-md px-2.5 py-1 transition-colors ${channelFilter === "whatsapp" ? "bg-white text-green-700 shadow-sm font-semibold" : "text-gray-600 hover:text-gray-900"}`}
            >
              💬 WhatsApp
            </button>
            <button
              onClick={() => { setChannelFilter("widget"); setPage(1); }}
              className={`rounded-md px-2.5 py-1 transition-colors ${channelFilter === "widget" ? "bg-white text-blue-700 shadow-sm font-semibold" : "text-gray-600 hover:text-gray-900"}`}
            >
              🌐 Widget
            </button>
            <button
              onClick={() => { setChannelFilter("web_api"); setPage(1); }}
              className={`rounded-md px-2.5 py-1 transition-colors ${channelFilter === "web_api" ? "bg-white text-purple-700 shadow-sm font-semibold" : "text-gray-600 hover:text-gray-900"}`}
            >
              ⚡ Web API
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Events</option>
            <option value="messages">💬 User Messages &amp; Replies</option>
            <option value="receipts">📬 Delivery Receipts</option>
            <option value="errors">⚠️ Errors &amp; Failures</option>
          </select>

          {/* Search Input */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
              placeholder="Search by phone, name, query, or error..."
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => fetchLogs()}
            className="rounded-lg bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Time &amp; Channel</th>
                <th className="px-4 py-3">Sender / Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">User Query</th>
                <th className="px-4 py-3">Assistant Response</th>
                <th className="px-4 py-3 text-right">Latency</th>
                <th className="px-4 py-3 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <p className="mt-2 text-xs">Loading logs...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No logs found matching the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const channel = CHANNEL_INFO[log.channel] || { label: log.channel, emoji: "💬", badgeColor: "bg-gray-100 text-gray-700 border-gray-200" };
                  const timeFormatted = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "—";
                  const dateFormatted = log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "";

                  return (
                    <tr
                      key={log.id}
                      onClick={() => { setSelectedLog(log); setActiveTab("overview"); }}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                    >
                      {/* Time & Channel */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${channel.badgeColor}`}>
                            <span>{channel.emoji}</span>
                            <span>{channel.label}</span>
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-gray-400">{dateFormatted} {timeFormatted}</p>
                      </td>

                      {/* Sender */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-gray-900">{log.sender_name || log.sender_id || "Anonymous"}</p>
                        {log.sender_name && log.sender_id && (
                          <p className="text-[10px] text-gray-400 font-mono">{log.sender_id}</p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>

                      {/* User Query */}
                      <td className="px-4 py-3 max-w-[200px] truncate">
                        {log.message_in ? (
                          <span className="font-medium text-gray-800">{log.message_in}</span>
                        ) : (
                          <span className="italic text-gray-400">(webhook event)</span>
                        )}
                      </td>

                      {/* Assistant Response */}
                      <td className="px-4 py-3 max-w-[240px] truncate">
                        {log.response_out ? (
                          <span className="text-gray-600">{log.response_out}</span>
                        ) : log.error ? (
                          <span className="text-red-600 font-medium truncate">{log.error}</span>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>

                      {/* Latency */}
                      <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-gray-500">
                        {log.response_time_ms ? `${log.response_time_ms}ms` : "—"}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                            setActiveTab("overview");
                          }}
                          className="rounded-md bg-gray-100 hover:bg-blue-600 hover:text-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors"
                        >
                          View JSON
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {total > 25 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 bg-gray-50 text-xs">
            <p className="text-gray-500">
              Showing <span className="font-semibold text-gray-800">{(page - 1) * 25 + 1}</span> to{" "}
              <span className="font-semibold text-gray-800">{Math.min(page * 25, total)}</span> of{" "}
              <span className="font-semibold text-gray-800">{total}</span> events
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1 font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 shadow-sm"
              >
                Previous
              </button>
              <button
                disabled={page * 25 >= total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1 font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail & Full JSON Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{CHANNEL_INFO[selectedLog.channel]?.emoji || "📋"}</span>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Request Inspector &amp; Payload Explorer
                  </h2>
                  <p className="text-xs text-gray-500">
                    {selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : ""} · {selectedLog.channel.toUpperCase()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Tab Navigation */}
            <div className="flex border-b border-gray-200 bg-white px-6">
              {[
                { id: "overview", label: "💬 Conversation & Overview" },
                { id: "raw", label: "📦 Incoming Raw Payload (Meta JSON)" },
                { id: "outgoing", label: "📤 Outgoing Payload & Meta API" },
                ...(selectedLog.error || selectedLog.traceback ? [{ id: "error", label: "⚠️ Error Details" }] : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`border-b-2 py-3 px-4 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Tab 1: Overview & Conversation Preview */}
              {activeTab === "overview" && (
                <div className="space-y-5">
                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Sender / Contact</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">{selectedLog.sender_name || "—"}</p>
                      <p className="text-xs font-mono text-gray-500">{selectedLog.sender_id || "N/A"}</p>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Status</p>
                      <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Response Time</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">{selectedLog.response_time_ms ? `${selectedLog.response_time_ms} ms` : "N/A"}</p>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Channel</p>
                      <p className="mt-1 text-sm font-bold text-gray-900 capitalize">{selectedLog.channel}</p>
                    </div>
                  </div>

                  {/* Chat Preview */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Conversation Exchange</h3>
                    
                    {/* User Inbound */}
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        U
                      </div>
                      <div className="flex-1 rounded-2xl rounded-tl-sm bg-blue-600 text-white p-3 text-sm shadow-sm">
                        <p className="text-xs font-semibold text-blue-100 mb-0.5">{selectedLog.sender_name || selectedLog.sender_id || "User"}</p>
                        <p className="whitespace-pre-wrap">{selectedLog.message_in || "(No text message body)"}</p>
                      </div>
                    </div>

                    {/* Assistant Outbound */}
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                        AI
                      </div>
                      <div className="flex-1 rounded-2xl rounded-tl-sm bg-white border border-gray-200 text-gray-900 p-3 text-sm shadow-sm">
                        <p className="text-xs font-semibold text-emerald-600 mb-0.5">Assistant Response</p>
                        <p className="whitespace-pre-wrap">{selectedLog.response_out || (selectedLog.error ? `Error: ${selectedLog.error}` : "(No assistant response generated)")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Raw Incoming JSON Payload */}
              {activeTab === "raw" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-medium">Exact payload received from Meta / Platform Webhook:</p>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedLog.raw_payload || {}, null, 2), "raw")}
                      className="rounded bg-gray-100 hover:bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors"
                    >
                      {copiedKey === "raw" ? "✓ Copied" : "Copy JSON"}
                    </button>
                  </div>
                  <pre className="max-h-[450px] overflow-x-auto rounded-xl bg-gray-950 p-4 text-xs font-mono text-emerald-400 shadow-inner">
                    {JSON.stringify(selectedLog.raw_payload || { message: "No raw payload recorded" }, null, 2)}
                  </pre>
                </div>
              )}

              {/* Tab 3: Outgoing Payload & Meta Response */}
              {activeTab === "outgoing" && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-gray-500 font-medium">Payload sent to Meta WhatsApp API (`/v20.0/messages`):</p>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(selectedLog.outgoing_payload || {}, null, 2), "out")}
                        className="rounded bg-gray-100 hover:bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors"
                      >
                        {copiedKey === "out" ? "✓ Copied" : "Copy JSON"}
                      </button>
                    </div>
                    <pre className="max-h-[220px] overflow-x-auto rounded-xl bg-gray-950 p-4 text-xs font-mono text-sky-300 shadow-inner">
                      {JSON.stringify(selectedLog.outgoing_payload || { status: "No outgoing payload recorded" }, null, 2)}
                    </pre>
                  </div>

                  {selectedLog.meta_response && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-gray-500 font-medium">Response returned from Meta Graph API (Status: {selectedLog.meta_status}):</p>
                      </div>
                      <pre className="max-h-[200px] overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs font-mono text-amber-300 shadow-inner">
                        {JSON.stringify(selectedLog.meta_response, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Errors */}
              {activeTab === "error" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
                    <p className="font-bold text-xs text-red-700 uppercase">Error Message</p>
                    <p className="mt-1 text-sm font-semibold">{selectedLog.error || "Unknown error"}</p>
                  </div>

                  {selectedLog.traceback && (
                    <div>
                      <p className="text-xs font-bold text-gray-700 mb-1">Stack Trace:</p>
                      <pre className="max-h-[350px] overflow-x-auto rounded-xl bg-gray-950 p-4 text-xs font-mono text-red-400 shadow-inner">
                        {selectedLog.traceback}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-gray-200 px-6 py-3 bg-gray-50">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-gray-800 hover:bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
