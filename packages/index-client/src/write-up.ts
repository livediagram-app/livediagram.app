// Write It Up (liveworkspace/docs/specs/004-index/write-up.md, its blueprint): something from an item written as a page
// in a knowledgebase, as the person, through the knowledgebase's own door. The shapes the index's route and the
// editors' suggestions share (liveworkspace/docs/specs/016-notifications/suggestions.md).

/** A write-up's longest body (CROSS_APP_BODY_MAX's bound) and title, as a call's summary. */
export const WRITE_UP_BODY_MAX = 20_000;
export const WRITE_UP_TITLE_MAX = 200;

/** Where a write-up from an item goes by default: a knowledgebase the person can edit, or none. */
export type WriteUpTarget = { knowledgebase: { id: string; title: string } | null };

/** A write-up's body: the knowledgebase (from the target read), the page's title and its Markdown. */
export type WriteUpAsk = { knowledgebase: string; title: string; body: string };

/** What a write-up made: the page's title and its link. */
export type WriteUpAnswer = { page: { title: string; link: string } };

const ID = /^[A-Za-z0-9_:-]{1,128}$/;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

/** A write-up's body, or null: a knowledgebase id, a title of 1 to 200 characters, a body of 1 to 20,000. */
export function readWriteUpAsk(raw: unknown): WriteUpAsk | null {
  if (!isRecord(raw) || !isId(raw.knowledgebase)) return null;
  const { title, body } = raw;
  if (typeof title !== 'string' || typeof body !== 'string') return null;
  const t = title.trim();
  if (!t || t.length > WRITE_UP_TITLE_MAX) return null;
  if (!body.trim() || body.length > WRITE_UP_BODY_MAX) return null;
  return { knowledgebase: raw.knowledgebase, title: t, body };
}

/** Cuts text to a write-up's body, at a line where it can, so a long article still goes. */
export function writeUpBody(text: string): string {
  if (text.length <= WRITE_UP_BODY_MAX) return text;
  const cut = text.slice(0, WRITE_UP_BODY_MAX);
  const line = cut.lastIndexOf('\n');
  return line > WRITE_UP_BODY_MAX / 2 ? cut.slice(0, line) : cut;
}
