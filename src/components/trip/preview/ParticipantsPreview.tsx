import type { Participant } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";

interface ParticipantsPreviewProps {
  participants: Participant[];
}

export default function ParticipantsPreview({ participants }: ParticipantsPreviewProps) {
  const claimed = participants.filter((p) => p.user_id !== null);
  const unclaimed = participants.filter((p) => p.user_id === null);

  if (participants.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="font-serif text-sm uppercase tracking-wider text-[var(--ink-3)] mb-3">
        Who&rsquo;s going
      </h2>
      <div className="flex flex-wrap gap-3">
        {claimed.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <Avatar name={p.name} color={p.color} size="sm" />
            <span className="text-sm text-[var(--ink)]">{p.name ?? "Unnamed"}</span>
          </div>
        ))}
        {unclaimed.map((p) => {
          const pending = !!p.invited_email;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 border border-dashed border-[var(--paper-3)] rounded-full pl-1 pr-3 py-0.5"
              title={
                pending
                  ? `Pending — invited ${p.invited_email}`
                  : "Unclaimed — someone signing in can claim this spot"
              }
            >
              <Avatar name={p.name} color={p.color} size="sm" />
              <span className="text-sm text-[var(--ink-3)]">{p.name ?? "Unnamed"}</span>
              {pending && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                  pending
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
