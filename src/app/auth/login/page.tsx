"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const DEV_EMAIL = process.env.NEXT_PUBLIC_DEV_EMAIL;
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD;
const isDevLoginAvailable =
  process.env.NODE_ENV === "development" && !!DEV_EMAIL && !!DEV_PASSWORD;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e_mail: string, pw: string) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: e_mail, password: pw });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn(email, password);
  }

  async function handleDevLogin() {
    await signIn(DEV_EMAIL!, DEV_PASSWORD!);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Log in</h1>
          <p className="text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="underline hover:text-black dark:hover:text-white">
              Sign up
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-white"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-white"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>

          {isDevLoginAvailable && (
            <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleDevLogin}
                disabled={loading}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 transition-colors"
              >
                ⚡ Dev login
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
