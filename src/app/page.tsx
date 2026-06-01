import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/api/rbac";

function getDashboardPath(role: AppRole) {
  if (role === "owner") {
    return "/owner";
  }

  if (role === "admin") {
    return "/branch";
  }

  return "/tech";
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single<{ role: AppRole }>();

  if (!profile) {
    redirect("/login");
  }

  redirect(getDashboardPath(profile.role));
}
