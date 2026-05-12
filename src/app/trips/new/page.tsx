"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function NewTripPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    destination: "",
    start_date: "",
    end_date: "",
    essence: "",
    status: "upcoming" as "upcoming" | "past",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: dataRaw, error: err } = await supabase
      .from("trips")
      .insert({
        name: form.name.trim(),
        destination: form.destination || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        essence: form.essence || null,
        status: form.status,
        created_by: user.id,
      } as Record<string, unknown>)
      .select()
      .single();

    const data = dataRaw as Trip | null;

    if (err || !data) {
      setError("Failed to create trip. Try again.");
      setSaving(false);
      return;
    }

    await supabase.from("participants").insert({
      trip_id: data.id,
      user_id: user.id,
      name: user.user_metadata?.full_name ?? user.email,
      role: "organizer",
      color: "#c45c2e",
    } as Record<string, unknown>);

    router.push(`/trips/${data.id}`);
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="font-serif text-2xl font-bold text-[var(--ink)] mb-6">New trip</h1>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Trip name *">
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Tour du Mont Blanc"
            className="input"
          />
        </Field>

        <Field label="Destination">
          <input
            value={form.destination}
            onChange={(e) => update("destination", e.target.value)}
            placeholder="Chamonix, France"
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => update("start_date", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => update("end_date", e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field label="Essence (one sentence)">
          <input
            value={form.essence}
            onChange={(e) => update("essence", e.target.value)}
            placeholder="11 days across 4 countries on the world's most iconic trail."
            className="input"
          />
        </Field>

        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className="input"
          >
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create trip"}
        </button>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          background: var(--paper-2);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          border: 1px solid transparent;
        }
        .input:focus {
          border-color: var(--accent);
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--ink-3)] mb-1">{label}</label>
      {children}
    </div>
  );
}
