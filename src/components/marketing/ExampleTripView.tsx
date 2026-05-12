import { EXAMPLE_TRIP_BUNDLE } from "@/lib/example-trip";
import TripPreviewHeader from "@/components/trip/preview/TripPreviewHeader";
import ParticipantsPreview from "@/components/trip/preview/ParticipantsPreview";
import ItineraryPreview from "@/components/trip/preview/ItineraryPreview";
import PackingPreview from "@/components/trip/preview/PackingPreview";
import ResourcesPreview from "@/components/trip/preview/ResourcesPreview";
import WelcomeBanner from "./WelcomeBanner";

interface ExampleTripViewProps {
  showOAuthBanner: boolean;
}

export default function ExampleTripView({ showOAuthBanner }: ExampleTripViewProps) {
  const { trip, participants, itinerary_blocks, packing_items, resources } = EXAMPLE_TRIP_BUNDLE;
  return (
    <>
      <WelcomeBanner showOAuth={showOAuthBanner} />
      <p className="text-xs uppercase tracking-wider text-[var(--ink-3)] font-medium mb-2">
        Example trip — explore what Wingit can do
      </p>
      <TripPreviewHeader
        trip={trip}
        blocks={itinerary_blocks}
        participantCount={participants.length}
      />
      <ParticipantsPreview participants={participants} />
      <ItineraryPreview blocks={itinerary_blocks} />
      <PackingPreview items={packing_items} />
      <ResourcesPreview resources={resources} />
    </>
  );
}
