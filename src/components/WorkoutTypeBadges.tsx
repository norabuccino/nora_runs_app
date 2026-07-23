import { resolveWorkoutTypeDisplay } from "@/lib/paceUtils";

interface WorkoutTypeBadgesProps {
  type: string;
  run_type?: string | null;
  strength_type?: string | null;
  compact?: boolean;
}

export function WorkoutTypeBadges({ type, run_type, strength_type, compact }: WorkoutTypeBadgesProps) {
  const { typeColor, typeLabel, subColor, subLabel } = resolveWorkoutTypeDisplay(type, run_type, strength_type);

  // In compact mode, show only the more specific sub-tag when one exists
  if (compact && subLabel && subColor) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${subColor}`}>
          {subLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap shrink-0">
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
        {typeLabel}
      </span>
      {subLabel && subColor && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${subColor}`}>
          {subLabel}
        </span>
      )}
    </div>
  );
}
