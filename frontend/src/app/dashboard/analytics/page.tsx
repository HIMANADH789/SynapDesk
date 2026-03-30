"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UsageStats, QueryLog } from "@/types";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.getUsage().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    api
      .getQueries(page)
      .then((res) => {
        setLogs(res.logs);
        setTotal(res.total);
      })
      .catch(console.error);
  }, [page]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Analytics</h1>

      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Queries</p>
            <p className="mt-1 text-2xl font-bold">{stats.total_queries}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Today</p>
            <p className="mt-1 text-2xl font-bold">{stats.queries_today}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Avg Response Time</p>
            <p className="mt-1 text-2xl font-bold">
              {stats.avg_response_time_ms}ms
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold">Query Log</h2>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No queries yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log, i) => (
              <div key={i} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      Q: {log.query}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      A: {log.response}
                    </p>
                  </div>
                  <div className="ml-4 text-right text-xs text-gray-400">
                    <p>{new Date(log.created_at).toLocaleString()}</p>
                    <p>{log.response_time_ms}ms</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {total > 20 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm text-blue-600 disabled:text-gray-300"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {Math.ceil(total / 20)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
              className="text-sm text-blue-600 disabled:text-gray-300"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
