import { redirect } from "next/navigation";
import { getIsAdmin } from "@/lib/profile";
import { getBadgeColors, getBadgeLayout } from "@/app/actions/badgeColors";
import { BadgeColorEditor } from "./BadgeColorEditor";

export default async function BadgesPage() {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) redirect("/dashboard");

  const [overrides, layout] = await Promise.all([getBadgeColors(), getBadgeLayout()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Badges</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Click any badge to customize its colors. Hover to remove. Use + Add badge to create new ones.
        </p>
      </div>
      <BadgeColorEditor initialOverrides={overrides} initialLayout={layout} />
    </div>
  );
}
