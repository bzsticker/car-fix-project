import type { ApiSupabaseClient } from "./auth";

type AuditLogInput = {
  supabase: ApiSupabaseClient;
  request?: Request;
  profileId?: string | null;
  action: string;
  tableName: string;
  recordId: string;
  oldValues?: unknown;
  newValues?: unknown;
};

function getRequestIp(request?: Request) {
  if (!request) {
    return null;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
}

export async function writeAuditLog({
  supabase,
  request,
  profileId,
  action,
  tableName,
  recordId,
  oldValues,
  newValues,
}: AuditLogInput) {
  const { error } = await supabase.from("audit_logs").insert({
    profile_id: profileId ?? null,
    action,
    table_name: tableName,
    record_id: recordId,
    old_values: oldValues ?? null,
    new_values: newValues ?? null,
    ip_address: getRequestIp(request),
  });

  if (error) {
    console.error("Failed to write audit log", {
      action,
      tableName,
      recordId,
      error: error.message,
    });
  }
}
