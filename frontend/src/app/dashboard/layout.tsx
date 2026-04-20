"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { getTokenPayload } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const { role, expired } = getTokenPayload();

    if (expired || !role) {
      router.replace("/login");
      return;
    }

    const isSuperAdminRoute = pathname.startsWith("/dashboard/super-admin");

    // Admin trying to access super-admin routes → bounce to their dashboard
    if (isSuperAdminRoute && role !== "super_admin") {
      router.replace("/dashboard");
      return;
    }

    // Super admin accessing plain /dashboard → redirect to super-admin overview
    if (pathname === "/dashboard" && role === "super_admin") {
      router.replace("/dashboard/super-admin");
      return;
    }

    setHydrated(true);
  }, [router, pathname]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <ImpersonationBanner />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
