import type { SupabaseClient } from "@supabase/supabase-js";

interface LogArgs {
  tripId: string;
  userId: string;
  actorName: string | null;
  action: string;
  targetId?: string | null;
  summary: string;
}

export async function logActivity(supabase: SupabaseClient, args: LogArgs) {
  await supabase.from("activity_log").insert({
    trip_id: args.tripId,
    user_id: args.userId,
    actor_name: args.actorName,
    action: args.action,
    target_id: args.targetId ?? null,
    summary: args.summary,
  });
}
