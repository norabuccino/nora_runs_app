"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "./ThemeProvider";
import { createClient } from "@/lib/supabase/client";
import { useUnitPreference } from "@/hooks/useUnitPreference";

interface NavProps {
  userEmail: string | null;
}

const navLinks = [
  { href: "/dashboard", label: "Today" },
  { href: "/my-plan", label: "My Plan" },
  { href: "/plans", label: "Plans" },
  { href: "/workouts", label: "Workouts" },
  { href: "/paces", label: "Paces" },
];

export function Nav({ userEmail }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unitPref, setUnitPref] = useUnitPreference();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!userEmail) return null;

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--background)] sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-sm tracking-tight">
            NBB Running
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  pathname.startsWith(link.href)
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Unit preference toggle */}
          <div className="hidden md:flex rounded border border-[var(--border)] overflow-hidden text-xs">
            {(["mi", "km"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnitPref(u)}
                className={`px-2 py-1 transition-colors ${
                  unitPref === u
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          <span className="hidden md:block text-xs text-[var(--muted)]">{userEmail}</span>

          <button
            onClick={handleSignOut}
            className="hidden md:block text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Sign out
          </button>

          <button
            className="md:hidden p-2 text-[var(--muted)]"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-[var(--border)] px-4 py-3 space-y-1 bg-[var(--background)]">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-sm ${
                pathname.startsWith(link.href)
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-xs text-[var(--muted)]">{userEmail}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
