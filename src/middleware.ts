import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isDashboardPath = pathname.startsWith("/owner") || 
                          pathname.startsWith("/branch") || 
                          pathname.startsWith("/tech");

  // 1. If user is NOT logged in and tries to access dashboard paths, redirect to login
  if (!user && isDashboardPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If user IS logged in and tries to access login or base path, route them by role
  if (user) {
    // Fetch profile role from database
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    if (pathname === "/login" || pathname === "/") {
      if (role === "owner") {
        return NextResponse.redirect(new URL("/owner", request.url));
      } else if (role === "admin") {
        return NextResponse.redirect(new URL("/branch", request.url));
      } else {
        return NextResponse.redirect(new URL("/tech", request.url));
      }
    }

    // 3. Prevent unauthorized role access to subfolders
    const isOwnerPath = pathname.startsWith("/owner");
    const isBranchPath = pathname.startsWith("/branch");
    const isTechPath = pathname.startsWith("/tech");

    if (isOwnerPath && role !== "owner") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (isBranchPath && role !== "admin" && role !== "owner") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (isTechPath && role !== "technician" && role !== "owner") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
