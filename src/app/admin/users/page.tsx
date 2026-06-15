import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/profile";
import { setUserRole } from "@/app/actions/admin";

export default async function AdminUsersPage() {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: { user: currentUser } }, { data: profiles }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("*").order("created_at"),
  ]);

  async function toggleRole(formData: FormData) {
    "use server";
    const userId = formData.get("user_id") as string;
    const currentRole = formData.get("current_role") as "admin" | "user";
    await setUserRole(userId, currentRole === "admin" ? "user" : "admin");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Grant or remove admin privileges for users.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {!profiles?.length ? (
          <p className="px-4 py-6 text-sm text-[var(--muted)]">No users found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--card)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)]">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)]">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {profile.email}
                    {profile.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-[var(--muted)]">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      profile.role === "admin"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {profile.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {profile.id !== currentUser?.id && (
                      <form action={toggleRole}>
                        <input type="hidden" name="user_id" value={profile.id} />
                        <input type="hidden" name="current_role" value={profile.role} />
                        <button
                          type="submit"
                          className={`text-xs hover:opacity-70 transition-opacity ${
                            profile.role === "admin"
                              ? "text-red-500"
                              : "text-[var(--accent)]"
                          }`}
                        >
                          {profile.role === "admin" ? "Remove admin" : "Make admin"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
