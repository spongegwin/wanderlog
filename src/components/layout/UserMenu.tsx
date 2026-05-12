"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

interface UserMenuProps {
  email: string;
  displayName: string;
  initials: string;
}

export default function UserMenu({ email, displayName, initials }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 hover:opacity-80 transition"
      >
        <span className="text-sm text-[var(--ink-3)] hidden sm:block">{displayName}</span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          {initials}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-[var(--paper-3)] rounded-lg shadow-md overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[var(--paper-3)]">
            <p className="text-sm font-medium text-[var(--ink)] truncate">{displayName}</p>
            <p className="text-xs text-[var(--ink-3)] truncate">{email}</p>
          </div>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--paper-2)] transition text-left disabled:opacity-50"
          >
            <LogOut size={14} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
