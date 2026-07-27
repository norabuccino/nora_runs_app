import Link from "next/link";

// Signups are closed while the app is under active development — see CLAUDE.md.
// Also disable "Allow new users to sign up" in the Supabase dashboard (Authentication
// settings), since the anon key is public and a closed page alone can't stop someone
// from calling supabase.auth.signUp() directly against the Supabase API.
export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-sm text-center space-y-3">
        <h1 className="text-2xl font-bold">Signups are closed</h1>
        <p className="text-sm text-gray-500">
          This app is still under development and isn&apos;t accepting new accounts
          right now.
        </p>
        <p className="text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="underline hover:text-black dark:hover:text-white">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
