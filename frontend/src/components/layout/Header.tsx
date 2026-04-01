"use client";

import { useAuth } from "@/lib/auth";

export default function Header() {
  const { logout, role, clientId } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
        {role === "super_admin" && (
          <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
            Super Admin
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {clientId && role !== "super_admin" && (
          <span className="hidden text-xs text-gray-400 sm:block">
            Institution:{" "}
            <span className="font-medium text-gray-600">{clientId}</span>
          </span>
        )}
        <button
          onClick={logout}
          className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
