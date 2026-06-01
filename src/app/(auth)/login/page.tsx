"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";

import type { AppRole } from "@/lib/api/rbac";
import { createClient } from "@/lib/supabase/client";

type ProfileRoleRow = {
  role: AppRole;
};

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (!data.user) {
        setError("Unable to load user session.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .is("deleted_at", null)
        .single<ProfileRoleRow>();

      if (profile?.role === "owner") {
        router.push("/owner");
      } else if (profile?.role === "admin") {
        router.push("/branch");
      } else {
        router.push("/tech");
      }

      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 border border-border bg-card/65 p-8 shadow-2xl shadow-red-950/5 backdrop-blur-md glass-card">
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            DEN <span className="text-brand-red">MODIFY</span>
          </h1>
          <p className="mt-2 text-sm text-muted">Workshop Staff Clock-In Terminal</p>
        </div>

        {error ? (
          <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">
            <p>{error}</p>
          </div>
        ) : null}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div className="relative">
              <label htmlFor="email" className="sr-only">
                Email Address
              </label>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <Mail size={18} />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="brand-input w-full pl-10 text-white placeholder-muted focus:border-brand-red focus:ring-1 focus:ring-brand-red"
                placeholder="Email Address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <Lock size={18} />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="brand-input w-full pl-10 text-white placeholder-muted focus:border-brand-red focus:ring-1 focus:ring-brand-red"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-md bg-brand-red px-4 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:scale-[1.01] hover:bg-brand-red-hover focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="mr-2 animate-spin text-white" size={18} /> : null}
            {loading ? "Authenticating..." : "Clock In / Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
