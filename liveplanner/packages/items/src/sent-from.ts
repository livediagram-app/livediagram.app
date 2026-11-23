// Where a card was sent from (docs/specs/026-plan/items.md "Sent From"; liveworkspace send-to-plan.md): the app, the
// item and the exact place, kept on the card as one plain string field (its JSON) the item store keeps as any unknown
// field, so no card face draws it and the card panel's footer names it ("Sent from Retro in livediagram"). Only the
// platform's Send to Plan sets it; a Community copy and an export leave it out.
export const SENT_FROM_FIELD = 'sentFrom';

const APPS = new Set([
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
  'liveknowledge',
]);
const KINDS = new Set(['element', 'text', 'thread', 'action']);
const TEXT_MAX = 2000;
const TITLE_MAX = 200;
const LINK_MAX = 2048;

export type CardSentFrom = {
  app: string;
  itemId: string;
  title: string;
  kind: string;
  label: string;
  text: string;
  link: string;
};

const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

// A link a card may open: the web's own, never a script's.
const isWebLink = (v: unknown): v is string =>
  str(v, LINK_MAX) && (v.startsWith('https://') || v.startsWith('http://'));

function readValue(v: unknown): CardSentFrom | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.app !== 'string' || !APPS.has(r.app)) return null;
  if (typeof r.kind !== 'string' || !KINDS.has(r.kind)) return null;
  if (!str(r.itemId, 200) || r.itemId === '' || !str(r.title, TITLE_MAX)) return null;
  if (!str(r.label, TITLE_MAX) || !str(r.text, TEXT_MAX) || !isWebLink(r.link)) return null;
  return {
    app: r.app,
    itemId: r.itemId,
    title: r.title,
    kind: r.kind,
    label: r.label,
    text: r.text,
    link: r.link,
  };
}

/** The field's value for a card's Sent From, or null for anything that is not one. */
export function sentFromValue(v: unknown): string | null {
  const read = readValue(v);
  return read ? JSON.stringify(read) : null;
}

/** The Sent From a card holds, or null. */
export function readSentFrom(v: unknown): CardSentFrom | null {
  if (typeof v !== 'string' || v.length > TEXT_MAX * 3) return null;
  try {
    return readValue(JSON.parse(v));
  } catch {
    return null;
  }
}
