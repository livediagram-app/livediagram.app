// Comment mentions (docs/specs/012-collaboration/comment-mentions.md): the structured list of teammates a
// comment `@`-tags, the handle a name becomes, and the pure helpers both the
// editor (composing, rendering) and the api worker (sanitising, indexing)
// share, so the two sides agree on what a mention is.

// One mentioned teammate. `userId` is their account id (null for an invited
// member the lazy claim hasn't identified); `memberId` their team membership
// row id. `handle` is what the text carries after the `@`.
export type CommentMention = {
  userId: string | null;
  memberId?: string;
  name: string;
  handle: string;
};

export const MENTIONS_MAX = 20;
const MENTION_FIELD_MAX = 100;

// `Thomas McClean` -> `thomas-mcclean`: lower kebab case, accents folded,
// anything else dropped. Empty when nothing usable is left.
export function mentionHandle(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MENTION_FIELD_MAX);
}

// Handles for a list of people, unique in list order: the second
// `thomas-mcclean` becomes `thomas-mcclean-2`. A person whose name yields
// nothing falls back to the local part of their email, then to `teammate`.
export function assignHandles<T extends { name: string; email?: string | null }>(
  people: readonly T[],
): (T & { handle: string })[] {
  const used = new Map<string, number>();
  return people.map((p) => {
    const base =
      mentionHandle(p.name) || mentionHandle((p.email ?? '').split('@')[0] ?? '') || 'teammate';
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return { ...p, handle: n === 1 ? base : `${base}-${n}` };
  });
}

// Whether `@handle` appears in the text as a whole token (not as the prefix
// of a longer handle, and not glued to the end of a word like an email).
export function textMentions(text: string, handle: string): boolean {
  const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w@])@${escaped}(?![\\w-])`, 'i').test(text);
}

// The mentions a comment keeps on send: those whose handle is still in the
// text, once each, capped.
export function mentionsInText(text: string, picked: readonly CommentMention[]): CommentMention[] {
  const seen = new Set<string>();
  const out: CommentMention[] = [];
  for (const m of picked) {
    const key = m.memberId ?? m.userId ?? m.handle;
    if (seen.has(key) || !textMentions(text, m.handle)) continue;
    seen.add(key);
    out.push(m);
    if (out.length === MENTIONS_MAX) break;
  }
  return out;
}

// Server-side cleaning of a list that arrived from a client: shape, caps and
// string fields only. Anything malformed is dropped, never repaired into
// something else. Returns undefined when nothing survives.
export function sanitizeMentions(value: unknown): CommentMention[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: CommentMention[] = [];
  const short = (v: unknown): v is string =>
    typeof v === 'string' && v.length > 0 && v.length <= MENTION_FIELD_MAX;
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const m = raw as Record<string, unknown>;
    const userId = m.userId === null ? null : short(m.userId) ? m.userId : undefined;
    const memberId = short(m.memberId) ? m.memberId : undefined;
    if (userId === undefined || (!userId && !memberId)) continue;
    if (!short(m.name) || !short(m.handle)) continue;
    out.push({ userId, ...(memberId ? { memberId } : {}), name: m.name, handle: m.handle });
    if (out.length === MENTIONS_MAX) break;
  }
  return out.length ? out : undefined;
}

// Split a comment's text into plain runs and the `@handle` runs that match
// one of its mentions, for the chip rendering. Unmatched `@words` stay plain.
export type MentionSegment = { text: string; mention?: CommentMention };

export function mentionSegments(
  text: string,
  mentions: readonly CommentMention[] | undefined,
): MentionSegment[] {
  if (!mentions?.length) return [{ text }];
  const byHandle = new Map(mentions.map((m) => [m.handle.toLowerCase(), m]));
  const out: MentionSegment[] = [];
  const re = /(^|[^\w@])@([a-z0-9]+(?:-[a-z0-9]+)*)/gi;
  let last = 0;
  for (let hit = re.exec(text); hit; hit = re.exec(text)) {
    const mention = byHandle.get(hit[2]!.toLowerCase());
    if (!mention) continue;
    const start = hit.index + hit[1]!.length;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: `@${hit[2]}`, mention });
    last = start + 1 + hit[2]!.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
