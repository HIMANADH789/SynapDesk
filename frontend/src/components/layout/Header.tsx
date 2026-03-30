"use client";

import { useAuth } from "@/lib/auth";

export default function Header() {
  const { logout } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
      <button
        onClick={logout}
        className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
      >
        Logout
      </button>
    </header>
  );
}
