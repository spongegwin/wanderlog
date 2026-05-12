import type { HikeDifficulty } from "@/lib/types";

const styles: Record<HikeDifficulty, string> = {
  easy: "bg-emerald-100 text-emerald-800",
  moderate: "bg-amber-100 text-amber-800",
  strenuous: "bg-red-100 text-red-800",
};

export default function DifficultyBadge({ difficulty }: { difficulty: HikeDifficulty }) {
  return (
    <span className={`${styles[difficulty]} text-xs font-medium px-2 py-0.5 rounded-full capitalize`}>
      {difficulty}
    </span>
  );
}
