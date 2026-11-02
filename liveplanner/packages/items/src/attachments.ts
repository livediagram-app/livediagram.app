// A card's Attachments (docs/specs/026-plan/items.md "Attachments"): pictures at liveworkspace's media service, kept on
// the card as `{ id, name, size, type, cover? }` entries, at most one of them its cover. The value's rules (validated
// for every door by fields.ts) and the pure edits the card panel and a card's drop make.
import type { Item, ItemFieldValue } from './item';
import {
  ITEM_ATTACHMENTS_MAX,
  ITEM_ATTACHMENT_BYTES_MAX,
  ITEM_ATTACHMENT_ID_MAX,
  ITEM_ATTACHMENT_NAME_MAX,
} from './limits';
import { isObj } from './validate';

export const ATTACHMENTS_FIELD = 'attachments';

// The types a picture may be: the media service's ACCEPTED_IMAGE_TYPES (never SVG).
export const ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export type ItemAttachment = {
  id: string;
  name: string;
  size: number;
  type: AttachmentType;
  cover?: true;
};

export const isAcceptedAttachmentType = (v: unknown): v is AttachmentType =>
  typeof v === 'string' && (ATTACHMENT_TYPES as readonly string[]).includes(v);

/** A file name as an entry keeps it: trimmed, cut to ITEM_ATTACHMENT_NAME_MAX characters, "Image" when blank. */
export function attachmentName(name: string): string {
  const cut = Array.from(name.trim()).slice(0, ITEM_ATTACHMENT_NAME_MAX).join('');
  return cut || 'Image';
}

function attachmentOf(v: unknown): ItemAttachment | undefined {
  if (!isObj(v)) return undefined;
  const { id, name, size, type, cover } = v;
  if (typeof id !== 'string' || id.length === 0 || id.length > ITEM_ATTACHMENT_ID_MAX)
    return undefined;
  if (typeof name !== 'string' || Array.from(name).length > ITEM_ATTACHMENT_NAME_MAX)
    return undefined;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1) return undefined;
  if (size > ITEM_ATTACHMENT_BYTES_MAX || !isAcceptedAttachmentType(type)) return undefined;
  if (cover !== undefined && cover !== true) return undefined;
  return { id, name: attachmentName(name), size, type, ...(cover ? { cover: true as const } : {}) };
}

/** An Attachments value as stored, or undefined when it breaks a rule: a list of at most ITEM_ATTACHMENTS_MAX
 *  entries, no picture twice, at most one cover. */
export function normaliseAttachments(v: unknown): ItemAttachment[] | undefined {
  if (!Array.isArray(v) || v.length > ITEM_ATTACHMENTS_MAX) return undefined;
  const out: ItemAttachment[] = [];
  for (const raw of v) {
    const a = attachmentOf(raw);
    if (!a || out.some((o) => o.id === a.id)) return undefined;
    out.push(a);
  }
  return out.filter((a) => a.cover).length > 1 ? undefined : out;
}

/** The card's attachments, in order; none for a card without (or with a value that is not a list of them). */
export function itemAttachments(item: Pick<Item, 'fields'>): ItemAttachment[] {
  return normaliseAttachments(item.fields[ATTACHMENTS_FIELD]) ?? [];
}

/** The card's cover picture, if one is set. */
export function attachmentCover(item: Pick<Item, 'fields'>): ItemAttachment | undefined {
  return itemAttachments(item).find((a) => a.cover);
}

/** `list` with `added` at its end, up to the card's cap: a picture it already holds is not added twice. `skipped` is
 *  how many did not fit. */
export function withAttachmentsAdded(
  list: readonly ItemAttachment[],
  added: readonly ItemAttachment[],
): { list: ItemAttachment[]; skipped: number } {
  const out = [...list];
  let skipped = 0;
  for (const a of added) {
    if (out.some((o) => o.id === a.id)) continue;
    if (out.length >= ITEM_ATTACHMENTS_MAX) {
      skipped++;
      continue;
    }
    const { cover: _cover, ...plain } = a;
    out.push(plain);
  }
  return { list: out, skipped };
}

/** `list` with `id` as its cover (null: none). */
export function withCover(list: readonly ItemAttachment[], id: string | null): ItemAttachment[] {
  return list.map(({ cover: _cover, ...a }) => (a.id === id ? { ...a, cover: true as const } : a));
}

/** `list` without picture `id`. */
export function withoutAttachment(list: readonly ItemAttachment[], id: string): ItemAttachment[] {
  return list.filter((a) => a.id !== id);
}

/** A list as a field value: undefined (the field cleared) when it is empty. */
export const attachmentsValue = (list: readonly ItemAttachment[]): ItemFieldValue | undefined =>
  list.length ? (list as unknown as ItemFieldValue) : undefined;

/** A size as people read it: "820 KB", "1.2 MB". */
export function attachmentSizeText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, '') : Math.round(mb)} MB`;
}
