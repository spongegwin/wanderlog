import { createClient } from "@/lib/supabase/server";
import type {
  Trip,
  Participant,
  ItineraryBlock,
  BlockBooking,
  PackingItem,
  Resource,
} from "@/lib/types";
import TripPreviewHeader from "@/components/trip/preview/TripPreviewHeader";
import ParticipantsPreview from "@/components/trip/preview/ParticipantsPreview";
import ItineraryPreview from "@/components/trip/preview/ItineraryPreview";
import PackingPreview from "@/components/trip/preview/PackingPreview";
import ResourcesPreview from "@/components/trip/preview/ResourcesPreview";
import JoinChoicePanel from "@/components/trip/JoinChoicePanel";

export const dynamic = "force-dynamic";

interface PreviewBundle {
  trip: Trip;
  participants: Participant[];
  itinerary_blocks: ItineraryBlock[];
  block_bookings: BlockBooking[];
  packing_items: PackingItem[];
  resources: Resource[];
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>;
}) {
  const { id, token } = await params;
  const supabase = await createClient();

  const { data: preview, error } = await supabase.rpc("get_trip_preview_by_token", {
    p_trip_id: id,
    p_token: token,
  });

  if (error || !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[var(--ink-3)]">Invite link not found.</p>
        </div>
      </div>
    );
  }

  const bundle = preview as PreviewBundle;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <TripPreviewHeader
          trip={bundle.trip}
          blocks={bundle.itinerary_blocks}
          participantCount={bundle.participants.length}
        />
        <ParticipantsPreview participants={bundle.participants} />
        <ItineraryPreview blocks={bundle.itinerary_blocks} />
        <PackingPreview items={bundle.packing_items} />
        <ResourcesPreview resources={bundle.resources} />
      </div>

      <JoinChoicePanel
        tripId={bundle.trip.id}
        tripName={bundle.trip.name}
        token={token}
        participants={bundle.participants}
        initialUserId={user?.id ?? null}
        initialEmail={user?.email ?? null}
        initialFullName={(user?.user_metadata?.full_name as string | undefined) ?? null}
      />
    </div>
  );
}
