import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">NBB Running App</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Log your runs, track your progress, crush your goals.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/login"
            className="px-6 py-3 rounded-lg bg-black text-white font-medium hover:bg-gray-800 transition-colors dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="px-6 py-3 rounded-lg border border-gray-300 font-medium hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
