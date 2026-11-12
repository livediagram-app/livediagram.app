// The pictures an agent places on cards (docs/specs/015-api/mcp-server.md §4.5b, docs/specs/026-plan/item-types.md
// "Image fields", items.md "Attachments"): an Image field's, a Several Images field's and Attachments' values as
// change_items' add and set take them, checked against the plan's grants before a card is written, and listed back
// with a link the agent can read. A value is `{ "add": [ids] }`, `{ "remove": [ids] }` (both together too), a bare id
// or a list of ids (read as add), or [] / null / "" (the field cleared). Only ids the plan holds a grant for (uploaded
// for it, with upload_image or the card panel) are placed, and an Attachments entry is made from the upload's own
// name, size and type, never the agent's.
import { ApiError, type ApiClient } from '@liveworkspace/api-client';
import {
  IMAGE_GRANT_CHECK_MAX,
  type GrantedImage,
  type ImageGrantsResponse,
} from '@liveplanner/api-schema';
import {
  ATTACHMENTS_FIELD,
  IMAGE_FIELD_PICTURES_MAX,
  ITEM_ATTACHMENTS_MAX,
  ITEM_ATTACHMENT_BYTES_MAX,
  ITEM_ATTACHMENT_ID_MAX,
  attachmentName,
  fieldImageIds,
  fieldKeyOf,
  holdsSeveralImages,
  imageFieldValue,
  isAcceptedAttachmentType,
  normaliseAttachments,
  withAttachmentsAdded,
  withImagesAdded,
  withoutImages,
  type CustomFieldDef,
  type ItemAttachment,
  type ItemFieldValue,
  type ItemTypeDef,
} from '@liveplanner/items';

// A picture field's change: ids added at the end and ids taken off, or the field emptied.
export type PictureEdit = { add: string[]; remove: string[] } | 'clear';

// The pictures the plan holds grants for, by id, as the api answered them: read once a call, asked again only for
// an id not yet asked about.
export type GrantedPictures = Map<string, GrantedImage | null>;

type Refusal = { ok: false; code: string; message: string };

// A result, or the refusal that says why not, as the item writes read them.
export type Checked<T> = ({ ok: true } & T) | Refusal;

const refuse = (code: string, message: string): Refusal => ({ ok: false, code, message });

// The words that say how a picture field takes its value, for a refusal.
const PICTURE_VALUE_HINT =
  'give picture ids from upload_image: {"add": ["<id>"]}, {"remove": ["<id>"]}, or [] to clear it';

export const IMAGE_UNKNOWN_MESSAGE =
  'That picture was not uploaded for this plan: upload it with upload_image first.';

// The custom Image field a key names on `type`, or Attachments; undefined for any other field.
function pictureFieldOf(
  key: string,
  type: ItemTypeDef,
): { attachments: true } | { field: CustomFieldDef } | undefined {
  if (key === ATTACHMENTS_FIELD) return { attachments: true };
  const field = type.custom?.find((f) => f.id === key);
  return field?.kind === 'image' ? { field } : undefined;
}

// Whether `key` is one of the card type's picture fields: an Image field (one picture or several) or Attachments.
export const isPictureKey = (key: string, type: ItemTypeDef): boolean =>
  pictureFieldOf(key, type) !== undefined;

// An id as a value names it: a string, or an object carrying one (a list_items entry, `{ id, link }`).
function idOf(value: unknown): string | null {
  const id =
    typeof value === 'object' && value !== null && 'id' in value
      ? (value as { id: unknown }).id
      : value;
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  return trimmed.length > 0 && trimmed.length <= ITEM_ATTACHMENT_ID_MAX ? trimmed : null;
}

// The ids a part of a value lists: one id, a comma list of them (the CLI's key=a,b), or a list.
function idsOf(value: unknown, label: string): Checked<{ ids: string[] }> {
  const parts = Array.isArray(value)
    ? (value as unknown[])
    : typeof value === 'string'
      ? value.split(',').filter((p) => p.trim() !== '')
      : [value];
  const ids: string[] = [];
  for (const part of parts) {
    const id = idOf(part);
    if (id === null)
      return refuse('value_invalid', `${label} takes pictures by id: ${PICTURE_VALUE_HINT}.`);
    if (!ids.includes(id)) ids.push(id);
  }
  return { ok: true, ids };
}

const isBlank = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

// A picture field's value as an agent writes it, read as a change.
export function pictureEditOf(value: unknown, label: string): Checked<{ edit: PictureEdit }> {
  if (isBlank(value)) return { ok: true, edit: 'clear' };
  if (typeof value === 'object' && !Array.isArray(value) && !('id' in value!)) {
    const rec = value as Record<string, unknown>;
    const other = Object.keys(rec).find((k) => k !== 'add' && k !== 'remove');
    if (other !== undefined || (rec['add'] === undefined && rec['remove'] === undefined))
      return refuse('value_invalid', `${label} takes pictures by id: ${PICTURE_VALUE_HINT}.`);
    const add = isBlank(rec['add']) ? { ok: true as const, ids: [] } : idsOf(rec['add'], label);
    if (!add.ok) return add;
    const remove = isBlank(rec['remove'])
      ? { ok: true as const, ids: [] }
      : idsOf(rec['remove'], label);
    if (!remove.ok) return remove;
    return { ok: true, edit: { add: add.ids, remove: remove.ids } };
  }
  const add = idsOf(value, label);
  if (!add.ok) return add;
  return { ok: true, edit: { add: add.ids, remove: [] } };
}

// `input` with its picture fields taken out, each read as a change by its field key; every other field is left for
// resolveFields, which names an unknown one. Attachments only on a type that offers them.
export function splitPictureFields(
  input: Readonly<Record<string, unknown>> | undefined,
  type: ItemTypeDef,
): Checked<{ rest: Record<string, unknown>; pictures: Map<string, PictureEdit> }> {
  const rest: Record<string, unknown> = {};
  const pictures = new Map<string, PictureEdit>();
  for (const [raw, value] of Object.entries(input ?? {})) {
    const named = fieldKeyOf(raw, type);
    const picture = named.ok ? pictureFieldOf(named.key, type) : undefined;
    if (!named.ok || !picture) {
      rest[raw] = value;
      continue;
    }
    if ('attachments' in picture && !type.fields.includes(ATTACHMENTS_FIELD))
      return refuse(
        'field_unknown',
        `${type.label} cards have no Attachments: add attachments to the type's fields with change_card_types.`,
      );
    const label = 'field' in picture ? picture.field.label : 'Attachments';
    const read = pictureEditOf(value, label);
    if (!read.ok) return read;
    pictures.set(named.key, read.edit);
  }
  return { ok: true, rest, pictures };
}

// Every id the changes add, each once.
export function addedPictureIds(pictures: ReadonlyMap<string, PictureEdit>): string[] {
  const out: string[] = [];
  for (const edit of pictures.values())
    if (edit !== 'clear') for (const id of edit.add) if (!out.includes(id)) out.push(id);
  return out;
}

// Asks the plan which of `ids` it holds grants for, the ids not asked about before only, and refuses the first it
// holds none for. One request a call, at most IMAGE_GRANT_CHECK_MAX ids.
export async function checkPictureGrants(
  api: ApiClient,
  projectId: string,
  ids: readonly string[],
  granted: GrantedPictures,
): Promise<Checked<object>> {
  const ask = [...new Set(ids)].filter((id) => !granted.has(id));
  if (ask.length > IMAGE_GRANT_CHECK_MAX)
    return refuse(
      'too_many_pictures',
      `A call places at most ${IMAGE_GRANT_CHECK_MAX} pictures: split the changes over more calls.`,
    );
  if (ask.length > 0) {
    let answer: ImageGrantsResponse;
    try {
      answer = await api.json<ImageGrantsResponse>(
        `/images/grants?p=${encodeURIComponent(projectId)}`,
        { method: 'POST', body: JSON.stringify({ ids: ask }) },
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code !== 'read_only_token')
        return refuse('forbidden', 'You can view this plan but not add pictures to it.');
      if (err instanceof ApiError && err.status === 503)
        return refuse('images_unavailable', 'Pictures are not available on this server.');
      throw err;
    }
    for (const id of ask) granted.set(id, null);
    for (const image of answer.images) granted.set(image.id, image);
  }
  const unknown = ids.find((id) => !granted.get(id));
  if (unknown !== undefined)
    return refuse('image_unknown', `${IMAGE_UNKNOWN_MESSAGE} (${JSON.stringify(unknown)})`);
  return { ok: true };
}

// An Attachments entry for a granted picture, made from its upload's record; undefined when the upload is one an
// entry cannot hold (a type or size the card's rules refuse).
function attachmentFor(image: GrantedImage): ItemAttachment | undefined {
  if (!isAcceptedAttachmentType(image.type)) return undefined;
  if (!Number.isInteger(image.size) || image.size < 1 || image.size > ITEM_ATTACHMENT_BYTES_MAX)
    return undefined;
  return {
    id: image.id,
    name: attachmentName(image.name ?? ''),
    size: image.size,
    type: image.type,
  };
}

const fullRefusal = (label: string, max: number, held: number) =>
  refuse(
    'too_many_pictures',
    `${label} holds up to ${max} pictures: it has ${held}, so ${Math.max(0, max - held)} more fit.`,
  );

// The value a picture field takes from its change, against the card's fields as read (`had`): undefined clears it.
// Every added id has been checked (checkPictureGrants), so `granted` holds it.
export function pictureValue(
  key: string,
  type: ItemTypeDef,
  edit: PictureEdit,
  had: Readonly<Record<string, unknown>>,
  granted: GrantedPictures,
): Checked<{ value: ItemFieldValue | undefined }> {
  if (edit === 'clear') return { ok: true, value: undefined };
  const picture = pictureFieldOf(key, type)!;
  if ('attachments' in picture) {
    const kept = (normaliseAttachments(had[ATTACHMENTS_FIELD]) ?? []).filter(
      (a) => !edit.remove.includes(a.id),
    );
    const added: ItemAttachment[] = [];
    for (const id of edit.add) {
      // One the card already holds stays as it is (its name and cover kept).
      if (kept.some((a) => a.id === id)) continue;
      const entry = attachmentFor(granted.get(id)!);
      if (!entry)
        return refuse(
          'value_invalid',
          `Picture ${JSON.stringify(id)} can't be an attachment: Attachments take PNG, JPEG, WebP or GIF up to 10 MB.`,
        );
      added.push(entry);
    }
    const { list, skipped } = withAttachmentsAdded(kept, added);
    if (skipped > 0) return fullRefusal('Attachments', ITEM_ATTACHMENTS_MAX, kept.length);
    return { ok: true, value: list.length ? (list as unknown as ItemFieldValue) : undefined };
  }
  const { field } = picture;
  const kept = withoutImages(fieldImageIds(field, had[key]), edit.remove);
  if (!holdsSeveralImages(field)) {
    if (edit.add.length > 1)
      return refuse(
        'value_invalid',
        `${field.label} holds one picture: give one id, or let it hold several with change_card_types (multiple: true).`,
      );
    return { ok: true, value: imageFieldValue(field, edit.add.length ? edit.add : kept) };
  }
  const { ids, skipped } = withImagesAdded(kept, edit.add);
  if (skipped > 0) return fullRefusal(field.label, IMAGE_FIELD_PICTURES_MAX, kept.length);
  return { ok: true, value: imageFieldValue(field, ids) };
}

// How a set line reads a picture field's new value back: how many pictures it holds.
export function picturesText(value: unknown): string {
  const n = Array.isArray(value) ? value.length : 1;
  return `${n} picture${n === 1 ? '' : 's'}`;
}

// A link to a picture of plan `projectId` the agent can read: the api's byte read, which answers it to the agent's
// own token as to the person (docs/specs/026-plan/item-types.md "Reading the bytes").
export type PictureLink = (imageId: string) => string;

export const pictureLinkFor =
  (appBase: string, projectId: string): PictureLink =>
  (imageId) =>
    `${appBase}/api/images/${encodeURIComponent(imageId)}?p=${encodeURIComponent(projectId)}`;
