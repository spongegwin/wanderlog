import type { Participant } from "./types";

export interface ClaimSuggestionUser {
  email: string | null | undefined;
  fullName: string | null | undefined;
}

export interface ClaimSuggestion {
  participant: Participant;
  score: number;
}

function tokenize(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[\s._+\-@]+/)
    .filter((t) => t.length >= 2);
}

function emailLocalPart(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  return at === -1 ? email : email.slice(0, at);
}

export function suggestClaimMatches(
  user: ClaimSuggestionUser,
  unclaimed: Participant[]
): ClaimSuggestion[] {
  const userTokens = new Set<string>([
    ...tokenize(user.fullName),
    ...tokenize(emailLocalPart(user.email)),
  ]);

  if (userTokens.size === 0) return [];

  const ranked: ClaimSuggestion[] = [];
  for (const p of unclaimed) {
    if (p.user_id !== null) continue;
    const pTokens = tokenize(p.name);
    if (pTokens.length === 0) continue;
    let score = 0;
    for (const t of pTokens) {
      if (userTokens.has(t)) score += 1;
    }
    if (score > 0) ranked.push({ participant: p, score });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.participant.name?.length ?? 0) - (b.participant.name?.length ?? 0);
  });

  return ranked;
}
