// Workbench messages (docs/specs/013-workspace/workbench-embeds.md "Workbench messages", blueprint
// "Workbench messages"): the `postMessage` vocabulary between the workbench page and the tool framing
// it. Every message is `{ type, v: 1, ... }`; every field is validated and bounded on arrival, so a
// workbench can parse what the page sends with the same function the page parses what it receives.

import {
  normaliseWorkbenchName,
  WORKBENCH_HANDLE_PATTERN,
  WORKBENCH_SELECTION_MAX_REFS,
  type WorkbenchRole,
} from './workbench';

export type WorkbenchEndReason = 'expired' | 'revoked' | 'trashed' | 'refused';
type WorkbenchColourScheme = 'light' | 'dark';

export type HelloMessage = { type: 'livepages:hello'; v: 1 };
export type HelloAckMessage = { type: 'livepages:hello-ack'; v: 1; name: string };
export type DocumentReadyMessage = {
  type: 'livepages:ready';
  v: 1;
  documentId: string;
  documentName: string;
  tabId: string;
  tabName: string;
  role: WorkbenchRole;
};
// A workspace frame is ready once its Explorer mounts: no document yet.
export type WorkspaceReadyMessage = {
  type: 'livepages:ready';
  v: 1;
  scope: 'workspace';
  role: WorkbenchRole;
};
export type ReadyMessage = DocumentReadyMessage | WorkspaceReadyMessage;
export type TabMessage = { type: 'livepages:tab'; v: 1; tabId: string; tabName: string };
export type SelectionMessage = {
  type: 'livepages:selection';
  v: 1;
  documentId: string;
  documentName: string;
  tabId: string;
  rev: number;
  // 0 when nothing is selected; `reference` then reads `whole tab` (blueprint WB28).
  count: number;
  reference: string;
};
export type RenewMessage = { type: 'livepages:renew'; v: 1 };
export type TicketMessage = { type: 'livepages:ticket'; v: 1; ticket: string };
export type RevealMessage = { type: 'livepages:reveal'; v: 1; refs: string[] };
export type ThemeMessage = {
  type: 'livepages:theme';
  v: 1;
  colourScheme: WorkbenchColourScheme;
};
export type EndedMessage = { type: 'livepages:ended'; v: 1; reason: WorkbenchEndReason };
// Where a workspace frame is, sent on every move. `view` is the Explorer view's name, or `document`.
export type PlaceMessage = {
  type: 'livepages:place';
  v: 1;
  view: string;
  folderId: string | null;
  folderName: string | null;
  // The documents directly in the folder shown; null on every other view.
  documentCount: number | null;
  documentId: string | null;
  documentName: string | null;
  tabId: string | null;
  tabName: string | null;
  role: WorkbenchRole;
};
export type WorkbenchOpenTarget =
  { view: 'home' } | { folderId: string } | { documentId: string; tabId?: string };
// The workbench moves a workspace frame.
export type OpenMessage = { type: 'livepages:open'; v: 1; to: WorkbenchOpenTarget };

// What the page sends its workbench, and what the workbench sends the page.
export type PageToWorkbenchMessage =
  | HelloMessage
  | ReadyMessage
  | TabMessage
  | SelectionMessage
  | RenewMessage
  | EndedMessage
  | PlaceMessage;
export type WorkbenchToPageMessage =
  HelloAckMessage | TicketMessage | RevealMessage | ThemeMessage | OpenMessage;
type WorkbenchMessage = PageToWorkbenchMessage | WorkbenchToPageMessage;

export const WORKBENCH_MESSAGE_TYPES = [
  'livepages:hello',
  'livepages:hello-ack',
  'livepages:ready',
  'livepages:tab',
  'livepages:selection',
  'livepages:renew',
  'livepages:ticket',
  'livepages:reveal',
  'livepages:theme',
  'livepages:ended',
  'livepages:place',
  'livepages:open',
] as const;

// Which side is parsing: the page reads `to-page` messages, a workbench `to-workbench` ones. A known
// type travelling the other way is not one this side takes, so it reads as ignored.
export type WorkbenchMessageDirection = 'to-page' | 'to-workbench';

// A ref the workbench asks to reveal: an element ref the agent printed (blueprint: 1 to 64 characters).
const REF_MAX_LENGTH = 64;
// How much of an ignored message's type reaches a log line.
const IGNORED_TYPE_MAX_LENGTH = 64;

type ParsedWorkbenchMessage<M> = M | { ignored: string } | { invalid: string };

type Fields = Record<string, unknown>;
type Parser = (m: Fields) => WorkbenchMessage | null;

const isString = (v: unknown): v is string => typeof v === 'string';
const isStringOrNull = (v: unknown): v is string | null => v === null || isString(v);
const isCountOrNull = (v: unknown): v is number | null => v === null || isCount(v);
// A document, folder or tab id the workbench names (1 to 64 characters, as a ref).
const isId = (v: unknown): v is string =>
  isString(v) && v.length >= 1 && v.length <= REF_MAX_LENGTH;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const ROLES: readonly unknown[] = ['view', 'participate', 'edit'];
const REASONS: readonly unknown[] = ['expired', 'revoked', 'trashed', 'refused'];
const SCHEMES: readonly unknown[] = ['light', 'dark'];

const isRefList = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length >= 1 &&
  v.length <= WORKBENCH_SELECTION_MAX_REFS &&
  v.every((r) => isString(r) && r.length >= 1 && r.length <= REF_MAX_LENGTH);

const TO_WORKBENCH: Record<string, Parser> = {
  'livepages:hello': () => ({ type: 'livepages:hello', v: 1 }),
  'livepages:ready': (m) => {
    if (m.scope !== undefined) {
      return m.scope === 'workspace' && ROLES.includes(m.role)
        ? { type: 'livepages:ready', v: 1, scope: 'workspace', role: m.role as WorkbenchRole }
        : null;
    }
    return isString(m.documentId) &&
      isString(m.documentName) &&
      isString(m.tabId) &&
      isString(m.tabName) &&
      ROLES.includes(m.role)
      ? {
          type: 'livepages:ready',
          v: 1,
          documentId: m.documentId,
          documentName: m.documentName,
          tabId: m.tabId,
          tabName: m.tabName,
          role: m.role as WorkbenchRole,
        }
      : null;
  },
  'livepages:place': (m) =>
    isString(m.view) &&
    m.view.length >= 1 &&
    m.view.length <= REF_MAX_LENGTH &&
    isStringOrNull(m.folderId) &&
    isStringOrNull(m.folderName) &&
    isCountOrNull(m.documentCount) &&
    isStringOrNull(m.documentId) &&
    isStringOrNull(m.documentName) &&
    isStringOrNull(m.tabId) &&
    isStringOrNull(m.tabName) &&
    ROLES.includes(m.role)
      ? {
          type: 'livepages:place',
          v: 1,
          view: m.view,
          folderId: m.folderId,
          folderName: m.folderName,
          documentCount: m.documentCount,
          documentId: m.documentId,
          documentName: m.documentName,
          tabId: m.tabId,
          tabName: m.tabName,
          role: m.role as WorkbenchRole,
        }
      : null,
  'livepages:tab': (m) =>
    isString(m.tabId) && isString(m.tabName)
      ? { type: 'livepages:tab', v: 1, tabId: m.tabId, tabName: m.tabName }
      : null,
  'livepages:selection': (m) =>
    isString(m.documentId) &&
    isString(m.documentName) &&
    isString(m.tabId) &&
    isCount(m.rev) &&
    isCount(m.count) &&
    isString(m.reference)
      ? {
          type: 'livepages:selection',
          v: 1,
          documentId: m.documentId,
          documentName: m.documentName,
          tabId: m.tabId,
          rev: m.rev,
          count: m.count,
          reference: m.reference,
        }
      : null,
  'livepages:renew': () => ({ type: 'livepages:renew', v: 1 }),
  'livepages:ended': (m) =>
    REASONS.includes(m.reason)
      ? { type: 'livepages:ended', v: 1, reason: m.reason as WorkbenchEndReason }
      : null,
};

function openTargetOf(to: unknown): WorkbenchOpenTarget | null {
  if (typeof to !== 'object' || to === null) return null;
  const t = to as Fields;
  if (t.view === 'home') return { view: 'home' };
  if (isId(t.folderId)) return { folderId: t.folderId };
  if (!isId(t.documentId)) return null;
  if (t.tabId === undefined) return { documentId: t.documentId };
  return isId(t.tabId) ? { documentId: t.documentId, tabId: t.tabId } : null;
}

const TO_PAGE: Record<string, Parser> = {
  'livepages:open': (m) => {
    const to = openTargetOf(m.to);
    return to === null ? null : { type: 'livepages:open', v: 1, to };
  },
  'livepages:hello-ack': (m) => {
    const name = normaliseWorkbenchName(m.name);
    return name === null ? null : { type: 'livepages:hello-ack', v: 1, name };
  },
  'livepages:ticket': (m) =>
    isString(m.ticket) && WORKBENCH_HANDLE_PATTERN.test(m.ticket)
      ? { type: 'livepages:ticket', v: 1, ticket: m.ticket }
      : null,
  'livepages:reveal': (m) =>
    isRefList(m.refs) ? { type: 'livepages:reveal', v: 1, refs: [...m.refs] } : null,
  'livepages:theme': (m) =>
    SCHEMES.includes(m.colourScheme)
      ? {
          type: 'livepages:theme',
          v: 1,
          colourScheme: m.colourScheme as WorkbenchColourScheme,
        }
      : null,
};

export function parseWorkbenchMessage(
  data: unknown,
  direction: 'to-page',
): ParsedWorkbenchMessage<WorkbenchToPageMessage>;
export function parseWorkbenchMessage(
  data: unknown,
  direction: 'to-workbench',
): ParsedWorkbenchMessage<PageToWorkbenchMessage>;
export function parseWorkbenchMessage(
  data: unknown,
  direction: WorkbenchMessageDirection,
): ParsedWorkbenchMessage<WorkbenchMessage>;
export function parseWorkbenchMessage(
  data: unknown,
  direction: WorkbenchMessageDirection,
): ParsedWorkbenchMessage<WorkbenchMessage> {
  const fields: Fields = typeof data === 'object' && data !== null ? (data as Fields) : {};
  const type = String(fields.type).slice(0, IGNORED_TYPE_MAX_LENGTH);
  const parsers = direction === 'to-page' ? TO_PAGE : TO_WORKBENCH;
  const parse = Object.hasOwn(parsers, type) ? parsers[type] : undefined;
  if (!parse || fields.v !== 1) return { ignored: type };
  return parse(fields) ?? { invalid: type };
}
