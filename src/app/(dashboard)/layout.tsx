import React from "react";
import { redirect } from "next/navigation";

import Sidebar from "@/components/sidebar";
import type { AppRole } from "@/lib/api/rbac";
import { createClient } from "@/lib/supabase/server";

type DashboardProfile = {
  full_name: string;
  role: AppRole;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single<DashboardProfile>();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background lg:flex-row">
      <Sidebar role={profile.role} userName={profile.full_name} />
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
