import { requireApiAuth } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";

export async function GET() {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile } = auth;

  return apiSuccess({
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      branch_id: profile.branch_id,
    },
  });
}
