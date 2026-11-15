// Reading an item's collab push (./collab-push): each card, column, thread and action an app sends, checked and
// clipped to its limits before anything is written. Re-exported from ./collab-push.
import {
  COLLAB_PEOPLE_MAX,
  COLLAB_TEXT_MAX,
  type CardColumn,
  type CollabActionInput,
  type CollabCard,
  type CollabThreadInput,
} from '@liveworkspace/index-client';
import { isId, isPartId } from './codec';

export const LABEL_MAX = 200;
const TEXT_MAX = COLLAB_TEXT_MAX;
const COLOR_MAX = 32;
// People named on one thread.
const PEOPLE_MAX = COLLAB_PEOPLE_MAX;
// A form's response count is a count, not a list: anything past this is clearly wrong.
export const RESPONSES_MAX = 10_000_000;

export const clip = (value: unknown, max: number): string | null =>
  typeof value === 'string' ? value.slice(0, max) : null;
const optionalText = (value: unknown, max: number): string | null | undefined =>
  value === undefined || value === null ? null : (clip(value, max) ?? undefined);
export const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const idList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.length <= PEOPLE_MAX && value.every(isId)
    ? [...new Set(value)]
    : null;
export const nullableId = (value: unknown): value is string | null => value === null || isId(value);
// A form's public code: letters, digits, `-` and `_`, as the app makes them.
export const FORM_CODE = /^[A-Za-z0-9_-]{1,64}$/;

/** A card's facts, or null for an element's row; undefined when malformed. */
export function parseCard(value: unknown): CollabCard | null | undefined {
  if (value === undefined || value === null) return null;
  const c = value as Record<string, unknown>;
  if (typeof c !== 'object' || Array.isArray(c)) return undefined;
  const type = clip(c.type, LABEL_MAX);
  const typeLabel = clip(c.typeLabel, LABEL_MAX);
  const title = clip(c.title, LABEL_MAX);
  const key = c.key === null || c.key === undefined ? null : c.key;
  if (type === null || typeLabel === null || title === null) return undefined;
  if (key !== null && !isCount(key)) return undefined;
  // The card's own id, given when the row's element is not the card (one of its comment threads).
  if (c.id !== undefined && !isPartId(c.id)) return undefined;
  let board: CollabCard['board'] = null;
  if (c.board !== null && c.board !== undefined) {
    const b = c.board as Record<string, unknown>;
    const boardTitle = clip(b?.title, LABEL_MAX);
    const tabName = clip(b?.tabName, LABEL_MAX);
    if (!isPartId(b?.tabId) || !isPartId(b?.elementId) || boardTitle === null || tabName === null) {
      return undefined;
    }
    board = { tabId: b.tabId, elementId: b.elementId, title: boardTitle, tabName };
  }
  const column = parseColumn(c.column);
  return {
    ...(c.id !== undefined ? { id: c.id as string } : {}),
    key,
    type,
    typeLabel,
    title,
    board,
    ...(column ? { column } : {}),
  };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** The card's column as the Inbox shows it, or null: a malformed one is dropped, never the push refused, so an
 *  older or newer app's push still lands. */
export function parseColumn(value: unknown): CardColumn | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const c = value as Record<string, unknown>;
  const name = typeof c.name === 'string' ? c.name.trim().slice(0, LABEL_MAX) : '';
  if (!name || typeof c.done !== 'boolean') return null;
  return {
    name,
    ...(typeof c.color === 'string' && HEX_COLOR.test(c.color) ? { color: c.color } : {}),
    done: c.done,
  };
}

export function parseThread(value: unknown): CollabThreadInput | null {
  const t = value as Record<string, unknown> | null;
  if (!t || typeof t !== 'object') return null;
  const participantIds = idList(t.participantIds);
  const mentionedIds = idList(t.mentionedIds ?? []);
  const agentIds = idList(t.agentIds ?? []);
  const elementLabel = clip(t.elementLabel, LABEL_MAX);
  const latestText = clip(t.latestText, TEXT_MAX);
  const latestAuthorName = clip(t.latestAuthorName, LABEL_MAX);
  const latestAuthorColor =
    t.latestAuthorColor === undefined ? '' : clip(t.latestAuthorColor, COLOR_MAX);
  const card = parseCard(t.card);
  if (
    !isPartId(t.elementId) ||
    elementLabel === null ||
    typeof t.resolved !== 'boolean' ||
    !isCount(t.commentCount) ||
    !participantIds ||
    !mentionedIds ||
    !agentIds ||
    latestText === null ||
    latestAuthorName === null ||
    latestAuthorColor === null ||
    card === undefined ||
    !isTime(t.firstAt) ||
    !isTime(t.latestAt)
  ) {
    return null;
  }
  return {
    elementId: t.elementId,
    elementLabel,
    resolved: t.resolved,
    commentCount: t.commentCount,
    participantIds,
    mentionedIds,
    ...(agentIds.length > 0 ? { agentIds } : {}),
    latestText,
    latestAuthorName,
    latestAuthorColor,
    latestAuthorId: isId(t.latestAuthorId) ? t.latestAuthorId : null,
    resolvedById: isId(t.resolvedById) ? t.resolvedById : null,
    firstAt: t.firstAt,
    latestAt: t.latestAt,
    card,
  };
}

const STATUSES = new Set(['open', 'done', 'wont-do']);

export function parseAction(value: unknown): CollabActionInput | null {
  const a = value as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return null;
  const elementLabel = clip(a.elementLabel, LABEL_MAX);
  const name = clip(a.name, LABEL_MAX);
  const description = a.description === undefined ? '' : clip(a.description, TEXT_MAX);
  const assigneeName = optionalText(a.assigneeName, LABEL_MAX);
  const assignerName = optionalText(a.assignerName, LABEL_MAX);
  const card = parseCard(a.card);
  if (
    !isPartId(a.elementId) ||
    !isPartId(a.actionId) ||
    elementLabel === null ||
    name === null ||
    description === null ||
    assigneeName === undefined ||
    assignerName === undefined ||
    card === undefined ||
    typeof a.status !== 'string' ||
    !STATUSES.has(a.status) ||
    !nullableId(a.assigneeId ?? null) ||
    !isId(a.assignerId) ||
    !nullableId(a.teamId ?? null) ||
    !isTime(a.createdAt) ||
    !isTime(a.updatedAt)
  ) {
    return null;
  }
  return {
    elementId: a.elementId,
    actionId: a.actionId,
    elementLabel,
    name,
    description,
    status: a.status as CollabActionInput['status'],
    assigneeId: (a.assigneeId as string | null | undefined) ?? null,
    assigneeName,
    assignerId: a.assignerId,
    assignerName,
    teamId: (a.teamId as string | null | undefined) ?? null,
    doneById: isId(a.doneById) ? a.doneById : null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    card,
  };
}

/** Makes one tab's threads and actions match the push in one batch. Rows go in through json_each, a statement per
 *  table whatever the count. */
