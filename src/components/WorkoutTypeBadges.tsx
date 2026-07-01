import {
  WORKOUT_TYPE_COLORS,
  WORKOUT_TYPE_LABELS,
  RUN_TYPE_COLORS,
  RUN_TYPE_LABELS,
  STRENGTH_TYPE_COLORS,
  STRENGTH_TYPE_LABELS,
} from "@/lib/paceUtils";

interface WorkoutTypeBadgesProps {
  type: string;
  run_type?: string | null;
  strength_type?: string | null;
  compact?: boolean;
}

export function WorkoutTypeBadges({ type, run_type, strength_type, compact }: WorkoutTypeBadgesProps) {
  const typeColor = WORKOUT_TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  const typeLabel = WORKOUT_TYPE_LABELS[type] ?? type;

  const subColor =
    type === "strength" && strength_type
      ? STRENGTH_TYPE_COLORS[strength_type]
      : type === "run" && run_type
      ? RUN_TYPE_COLORS[run_type]
      : null;

  const subLabel =
    type === "strength" && strength_type
      ? STRENGTH_TYPE_LABELS[strength_type]
      : type === "run" && run_type
      ? RUN_TYPE_LABELS[run_type]
      : null;

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
