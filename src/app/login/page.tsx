"use client";

import React, { useState } from "react";
import { BrandMark } from "@/components/BrandLogo";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Authentication is not configured for this deployment.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Incorrect email or password."
            : signInError.message
        );
        return;
      }

      // Make sure this account is linked to an organization before entering.
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json().catch(() => null);
      if (!session?.authenticated) {
        await supabase.auth.signOut();
        setError(
          "Your account is not linked to an organization yet. Please contact your administrator."
        );
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl bg-[#0F141C] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={40} />
            <div>
              <span className="font-serif font-bold text-xl tracking-wide text-white">
                LUXE HAVEN
              </span>
              <p className="text-xs text-slate-400">
                Hospitality Management Portal
              </p>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white transition"
          >
            ← Back to Home
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Lock className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Sign in to your dashboard</span>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold transition disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In to Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
