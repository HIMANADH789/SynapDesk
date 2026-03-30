"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UsageStats } from "@/types";

export default function DashboardOverview() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    api.getUsage().then(setStats).catch(console.error);
    api
      .listDocuments()
      .then((res) => setDocCount(res.total))
      .catch(console.error);
  }, []);

  const cards = [
    {
      title: "Total Queries",
      value: stats?.total_queries ?? "—",
      color: "bg-blue-500",
    },
    {
      title: "Queries Today",
      value: stats?.queries_today ?? "—",
      color: "bg-green-500",
    },
    {
      title: "Documents",
      value: docCount,
      color: "bg-purple-500",
    },
    {
      title: "LLM Quota Left",
      value: stats?.remaining_llm_quota ?? "—",
      color: "bg-orange-500",
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Overview</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{card.title}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {card.value}
            </p>
            <div className={`mt-3 h-1 w-12 rounded-full ${card.color}`} />
          </div>
        ))}
      </div>

      {stats && stats.avg_response_time_ms > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Performance</h2>
          <p className="text-sm text-gray-600">
            Average response time:{" "}
            <span className="font-semibold">
              {stats.avg_response_time_ms}ms
            </span>
          </p>
        </div>
      )}

      {stats && stats.top_queries.length > 0 && (
        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Top Queries</h2>
          <div className="space-y-2">
            {stats.top_queries.map((q, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2"
              >
                <span className="text-sm text-gray-700">{q.query}</span>
                <span className="text-sm font-medium text-gray-500">
                  {q.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
