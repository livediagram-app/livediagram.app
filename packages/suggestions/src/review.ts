// An item's review settings (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "Suggest Only", and
// livedocuments/docs/specs/007-editor/suggestions.md "Suggest Only"): the Participant links and people whose changes
// are always suggestions, and whether an assistant's article writes are. Stored on the item's own row in its room
// (a `review` column), set by an Editor from the Share dialog, read by the room on every Participant frame. Read defensively: whatever is stored or sent is parsed and bounded here.

export const SUGGEST_ONLY_MAX_LINKS = 100;
export const SUGGEST_ONLY_MAX_PEOPLE = 200;
// A share code or a collab key, as the index and the room mint them.
const MAX_KEY = 64;
const MAX_NAME = 80;

export type ReviewPerson = { key: string; name: string };
// Someone who joined through a Participant link, so the Share dialog can list them; `at` is when, epoch ms.
export type ReviewSeen = ReviewPerson & { at: number };

/** What an Editor sets: the Suggest Only links (share codes) and people (collab keys), and Assistants Suggest.
 *  `lift`, sent only, names people whose pins go (they were on Suggest Only through a link). */
export type ReviewSettings = {
  links: string[];
  people: ReviewPerson[];
  agents: boolean;
  lift?: string[];
};
/** A person who arrived through a Suggest Only link, held to it on every later session whatever link (or none) they
 *  open with, while that link stays on Suggest Only. `key` is the server-verified collab key; `code` the link's. */
export type ReviewPin = { key: string; code: string; at: number };
/** What the item keeps: the settings, the people seen joining as Participants, and the pins. */
export type StoredReview = Omit<ReviewSettings, 'lift'> & { seen: ReviewSeen[]; pins: ReviewPin[] };

export const NO_REVIEW: StoredReview = { links: [], people: [], agents: false, seen: [], pins: [] };

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
  const lift = Array.isArray(r.lift)
    ? [...new Set((r.lift as unknown[]).filter(key))].slice(0, SUGGEST_ONLY_MAX_PEOPLE)
    : [];
  return {
    links,
    people: people(r.people, SUGGEST_ONLY_MAX_PEOPLE),
    agents: r.agents === true,
    ...(lift.length > 0 ? { lift } : {}),
  };
}

function pinsOf(v: unknown): ReviewPin[] {
  if (!Array.isArray(v)) return [];
  const out: ReviewPin[] = [];
  const taken = new Set<string>();
  for (const raw of v as unknown[]) {
    const p = raw as Record<string, unknown> | null;
    if (!p || typeof p !== 'object' || !key(p.key) || !key(p.code) || taken.has(p.key)) continue;
    taken.add(p.key);
    out.push({
      key: p.key,
      code: p.code,
      at: typeof p.at === 'number' && Number.isFinite(p.at) ? p.at : 0,
    });
    if (out.length >= SUGGEST_ONLY_MAX_PEOPLE) break;
  }
  return out;
}

/** The stored review an Editor's settings make: the sent settings, the people seen kept, and the pins kept but for
 *  those lifted and those whose link is no longer on Suggest Only. */
export function reviewFromSettings(stored: StoredReview, sent: ReviewSettings): StoredReview {
  const { lift = [], ...settings } = sent;
  const pins = stored.pins.filter((p) => !lift.includes(p.key) && settings.links.includes(p.code));
  return { ...settings, seen: stored.seen, pins };
}

/** The review with `key` pinned to Suggest Only link `code`; the same object when it already is. */
export function withReviewPinned(
  review: StoredReview,
  pinKey: string,
  code: string,
  at: number,
): StoredReview {
  if (!key(pinKey) || !key(code) || !review.links.includes(code)) return review;
  if (review.pins.some((p) => p.key === pinKey && p.code === code)) return review;
  const pins = [{ key: pinKey, code, at }, ...review.pins.filter((p) => p.key !== pinKey)].slice(
    0,
    SUGGEST_ONLY_MAX_PEOPLE,
  );
  return { ...review, pins };
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
  const { lift: _lift, ...settings } = parseReviewSettings(raw);
  void _lift;
  return { ...settings, seen, pins: pinsOf(r && typeof r === 'object' ? r.pins : null) };
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

/** Whether a Participant session suggests: its share code is a Suggest Only link, its collab key a Suggest Only
 *  person, or its verified collab key pinned to a link still on Suggest Only (it arrived through one before, so
 *  opening without the link's code changes nothing). */
export function suggestOnlyFor(
  review: Pick<ReviewSettings, 'links' | 'people'> & { pins?: readonly ReviewPin[] },
  session: { shareCode?: string | null; collabKey?: string | null; verifiedKey?: string | null },
): boolean {
  if (session.shareCode && review.links.includes(session.shareCode)) return true;
  if (session.collabKey && review.people.some((p) => p.key === session.collabKey)) return true;
  const pinned = session.verifiedKey;
  return Boolean(
    pinned && review.pins?.some((p) => p.key === pinned && review.links.includes(p.code)),
  );
}

/** The room's word to one Participant session on whether it suggests: a system op to its socket alone, sent when it
 *  joins and on every change. */
export type ReviewOp = { kind: 'review'; suggestOnly: boolean };

/** `GET` and `PUT /api/<items>/:id/review`'s answer. */
export type ReviewResponse = { review: StoredReview };
