import { redirect } from "next/navigation";
import { getIsAdmin } from "@/lib/profile";
import { getBadgeColors } from "@/app/actions/badgeColors";
import { BadgeColorEditor } from "./BadgeColorEditor";

export default async function BadgeColorsPage() {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) redirect("/dashboard");

  const overrides = await getBadgeColors();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Badge Colors</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Click any badge to customize its light and dark mode colors.
        </p>
      </div>
      <BadgeColorEditor initialOverrides={overrides} />
    </div>
  );
}
