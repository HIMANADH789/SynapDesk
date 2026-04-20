"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ImpersonationBanner() {
  const router = useRouter();
  const [impersonating, setImpersonating] = useState<{ name: string; clientId: string } | null>(null);

  useEffect(() => {
    const data = sessionStorage.getItem("impersonation");
    if (data) {
      try { setImpersonating(JSON.parse(data)); } catch {}
    }
  }, []);

  if (!impersonating) return null;

  function exitImpersonation() {
    const superAdminToken = sessionStorage.getItem("super_admin_token");
    if (superAdminToken) {
      localStorage.setItem("token", superAdminToken);
      sessionStorage.removeItem("super_admin_token");
      sessionStorage.removeItem("impersonation");
      // Full reload so AuthContext re-reads the super_admin token from localStorage
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-md">
      <div className="flex items-center gap-2">
        <span className="rounded bg-amber-600 px-2 py-0.5 text-xs font-bold">IMPERSONATING</span>
        <span>Viewing as admin of <strong>{impersonating.name}</strong> ({impersonating.clientId})</span>
      </div>
      <button
        onClick={exitImpersonation}
        className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
      >
        &larr; Return to Super Admin
      </button>
    </div>
  );
}
