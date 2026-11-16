// A document's review settings (docs/specs/007-editor/suggestions.md "Suggest Only"): the Participant links and
// people whose writing in articles is always suggestions, and whether an assistant's article writes are. Stored in
// the document's own room (`document.review`), set by an Editor from the Share dialog, read by the room on every
// Participant frame. Read defensively: whatever is stored or sent is parsed and bounded here.

export const SUGGEST_ONLY_MAX_LINKS = 100;
export const SUGGEST_ONLY_MAX_PEOPLE = 200;
// A share code or a collab key, as the index and the room mint them.
const MAX_KEY = 64;
const MAX_NAME = 80;

export type ReviewPerson = { key: string; name: string };
// Someone who joined through a Participant link, so the Share dialog can list them; `at` is when, epoch ms.
export type ReviewSeen = ReviewPerson & { at: number };

/** What an Editor sets: the Suggest Only links (share codes) and people (collab keys), and Assistants Suggest. */
export type ReviewSettings = { links: string[]; people: ReviewPerson[]; agents: boolean };
/** What the document keeps: the settings, and the people seen joining as Participants. */
export type StoredReview = ReviewSettings & { seen: ReviewSeen[] };

export const NO_REVIEW: StoredReview = { links: [], people: [], agents: false, seen: [] };

const key = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_KEY;
const nameOf = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, MAX_NAME) : '');

function people(v: unknown, max: number): ReviewPerson[] {
  if (!Array.isArray(v)) return [];
  const out: ReviewPerson[] = [];
  const taken = new Set<string>();
  for (const raw of v as unknown[]) {
    const p = raw as Record<string, unknown> | null;
    if (!p || typeof p !== 'object' || !key(p.key) || taken.has(p.key)) continue;
    taken.add(p.key);
    out.push({ key: p.key, name: nameOf(p.name) });
    if (out.length >= max) break;
  }
  return out;
}

/** The settings an Editor sent, or a stored row's, bounded: unknown entries and repeats dropped. */
export function parseReviewSettings(v: unknown): ReviewSettings {
  const r = v as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return { links: [], people: [], agents: false };
  const links = Array.isArray(r.links)
    ? [...new Set((r.links as unknown[]).filter(key))].slice(0, SUGGEST_ONLY_MAX_LINKS)
    : [];
  return {
    links,
    people: people(r.people, SUGGEST_ONLY_MAX_PEOPLE),
    agents: r.agents === true,
  };
}

/** A stored row (JSON text, or null for none), read defensively. */
export function parseStoredReview(text: string | null | undefined): StoredReview {
  if (!text) return NO_REVIEW;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NO_REVIEW;
  }
  const r = raw as Record<string, unknown> | null;
  const seen: ReviewSeen[] = [];
  if (r && typeof r === 'object' && Array.isArray(r.seen)) {
    for (const p of people(r.seen, SUGGEST_ONLY_MAX_PEOPLE)) {
      const at = (r.seen as Record<string, unknown>[]).find((s) => s?.key === p.key)?.at;
      seen.push({ ...p, at: typeof at === 'number' && Number.isFinite(at) ? at : 0 });
    }
  }
  return { ...parseReviewSettings(raw), seen };
}

/** The review with `person` noted as having joined as a Participant (most recent first, bounded); the same object
 *  when they were already noted under that name. */
export function withReviewSeen(
  review: StoredReview,
  person: ReviewPerson,
  at: number,
): StoredReview {
  if (!key(person.key)) return review;
  const name = nameOf(person.name);
  const was = review.seen.find((s) => s.key === person.key);
  if (was && was.name === name) return review;
  const seen = [
    { key: person.key, name, at },
    ...review.seen.filter((s) => s.key !== person.key),
  ].slice(0, SUGGEST_ONLY_MAX_PEOPLE);
  return { ...review, seen };
}

/** Whether a Participant session suggests: its share code is a Suggest Only link, or its collab key a Suggest Only
 *  person. */
export function suggestOnlyFor(
  review: ReviewSettings,
  session: { shareCode?: string | null; collabKey?: string | null },
): boolean {
  if (session.shareCode && review.links.includes(session.shareCode)) return true;
  return Boolean(session.collabKey && review.people.some((p) => p.key === session.collabKey));
}

/** The room's word to one Participant session on whether it suggests (sent when it joins and on every change). */
export type ReviewMessage = { kind: 'review'; suggestOnly: boolean };

/** `GET` and `PUT /api/documents/:id/review`'s answer. */
export type ReviewResponse = { review: StoredReview };
