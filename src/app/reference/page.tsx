import Link from "next/link";
import { LoadFormatGuide } from "@/components/LoadFormatGuide";

export default function ReferencePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reference</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Quick reminders for setting up and logging workouts.</p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Load formats</h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            For exercises with weight tracking on, the load format says what a logged number means. Set it per exercise on{" "}
            <Link href="/exercises" className="text-[var(--accent)] hover:underline">Exercises</Link>.
          </p>
        </div>
        <LoadFormatGuide />
      </section>
    </div>
  );
}
