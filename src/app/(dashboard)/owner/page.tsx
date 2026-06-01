import { createAdminClient } from "@/lib/supabase/server";
import OwnerPageClient from "@/components/owner-page-client";

type PaymentRow = {
  amount: number | string;
};

type AttendanceRow = {
  id: string;
  clock_in: string;
  profile: { full_name: string } | { full_name: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export const revalidate = 0;

export default async function OwnerPage() {
  const supabase = createAdminClient();
  const [
    { count: branchCount },
    { count: jobsCount },
    { data: payments },
    { data: activeAttendance },
  ] = await Promise.all([
    supabase.from("branches").select("*", { count: "exact", head: true }),
    supabase.from("jobs").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("payments").select("amount"),
    supabase.from("attendance_logs")
      .select("id, clock_in, profile:profiles(full_name)")
      .is("clock_out", null),
  ]);

  const normalizedAttendance = ((activeAttendance ?? []) as AttendanceRow[]).map((log) => ({
    id: log.id,
    clock_in: log.clock_in,
    profile: firstRelation(log.profile),
  }));

  return (
    <OwnerPageClient
      branchCount={branchCount}
      jobsCount={jobsCount}
      payments={payments as PaymentRow[] | null}
      activeAttendance={normalizedAttendance}
    />
  );
}
