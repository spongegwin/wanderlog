import type { BlockStatus } from "@/lib/types";

const styles: Record<BlockStatus, string> = {
  idea: "bg-[var(--paper-3)] text-[var(--ink-2)]",
  suggested: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-[var(--paper-2)] text-[var(--ink-3)] line-through",
};

const labels: Record<BlockStatus, string> = {
  idea: "Idea",
  suggested: "Suggested",
  confirmed: "Confirmed",
  completed: "Done",
};

export default function StatusBadge({ status }: { status: BlockStatus }) {
  return (
    <span className={`${styles[status]} text-xs font-medium px-2 py-0.5 rounded-full`}>
      {labels[status]}
    </span>
  );
}
