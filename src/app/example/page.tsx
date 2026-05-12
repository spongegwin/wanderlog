import { createClient } from "@/lib/supabase/server";
import ExampleTripView from "@/components/marketing/ExampleTripView";

export const dynamic = "force-dynamic";

export default async function ExamplePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <ExampleTripView showOAuthBanner={!user} />
    </main>
  );
}
