import type { Metadata } from "next";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/profile";

export const metadata: Metadata = {
  title: "NBB Running App",
  description: "Plan your marathon and strength training",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userEmail: string | null = null;
  let isAdmin = false;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
    if (user) isAdmin = await getIsAdmin();
  } catch {
    // If Supabase is unreachable, render without auth state.
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <ThemeProvider>
          <Nav userEmail={userEmail} isAdmin={isAdmin} />
          <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
