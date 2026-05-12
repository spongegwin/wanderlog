import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "./UserMenu";

export default async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const fullName: string = user.user_metadata?.full_name ?? "";
  const initials = fullName
    ? fullName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? "?").toUpperCase();

  const displayName = fullName || user.email?.split("@")[0] || "You";

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[var(--paper-3)]">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link
          href="/"
          className="font-serif font-bold text-[var(--ink)] hover:text-[var(--accent)] transition text-base"
        >
          Wanderlog
        </Link>
        <UserMenu
          email={user.email ?? ""}
          displayName={displayName}
          initials={initials}
        />
      </div>
    </header>
  );
}
