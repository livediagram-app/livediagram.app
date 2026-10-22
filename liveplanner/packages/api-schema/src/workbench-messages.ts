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

export type HelloMessage = { type: 'liveplanner:hello'; v: 1 };
export type HelloAckMessage = { type: 'liveplanner:hello-ack'; v: 1; name: string };
export type ProjectReadyMessage = {
  type: 'liveplanner:ready';
  v: 1;
  projectId: string;
  projectName: string;
  tabId: string;
  tabName: string;
  role: WorkbenchRole;
};
// A workspace frame is ready once its Explorer mounts: no project yet.
export type WorkspaceReadyMessage = {
  type: 'liveplanner:ready';
  v: 1;
  scope: 'workspace';
  role: WorkbenchRole;
};
export type ReadyMessage = ProjectReadyMessage | WorkspaceReadyMessage;
export type TabMessage = { type: 'liveplanner:tab'; v: 1; tabId: string; tabName: string };
export type SelectionMessage = {
  type: 'liveplanner:selection';
  v: 1;
  projectId: string;
  projectName: string;
  tabId: string;
  rev: number;
  // 0 when nothing is selected; `reference` then reads `whole tab` (blueprint WB28).
  count: number;
  reference: string;
};
export type RenewMessage = { type: 'liveplanner:renew'; v: 1 };
export type TicketMessage = { type: 'liveplanner:ticket'; v: 1; ticket: string };
export type RevealMessage = { type: 'liveplanner:reveal'; v: 1; refs: string[] };
export type ThemeMessage = {
  type: 'liveplanner:theme';
  v: 1;
  colourScheme: WorkbenchColourScheme;
};
export type EndedMessage = { type: 'liveplanner:ended'; v: 1; reason: WorkbenchEndReason };
// Where a workspace frame is, sent on every move. `view` is the Explorer view's name, or `project`.
export type PlaceMessage = {
  type: 'liveplanner:place';
  v: 1;
  view: string;
  folderId: string | null;
  folderName: string | null;
  // The projects directly in the folder shown; null on every other view.
  projectCount: number | null;
  projectId: string | null;
  projectName: string | null;
  tabId: string | null;
  tabName: string | null;
  role: WorkbenchRole;
};
export type WorkbenchOpenTarget =
  { view: 'home' } | { folderId: string } | { projectId: string; tabId?: string };
// The workbench moves a workspace frame.
export type OpenMessage = { type: 'liveplanner:open'; v: 1; to: WorkbenchOpenTarget };

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
  'liveplanner:hello',
  'liveplanner:hello-ack',
  'liveplanner:ready',
  'liveplanner:tab',
  'liveplanner:selection',
  'liveplanner:renew',
  'liveplanner:ticket',
  'liveplanner:reveal',
  'liveplanner:theme',
  'liveplanner:ended',
  'liveplanner:place',
  'liveplanner:open',
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
// A project, folder or tab id the workbench names (1 to 64 characters, as a ref).
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
  'liveplanner:hello': () => ({ type: 'liveplanner:hello', v: 1 }),
  'liveplanner:ready': (m) => {
    if (m.scope !== undefined) {
      return m.scope === 'workspace' && ROLES.includes(m.role)
        ? { type: 'liveplanner:ready', v: 1, scope: 'workspace', role: m.role as WorkbenchRole }
        : null;
    }
    return isString(m.projectId) &&
      isString(m.projectName) &&
      isString(m.tabId) &&
      isString(m.tabName) &&
      ROLES.includes(m.role)
      ? {
          type: 'liveplanner:ready',
          v: 1,
          projectId: m.projectId,
          projectName: m.projectName,
          tabId: m.tabId,
          tabName: m.tabName,
          role: m.role as WorkbenchRole,
        }
      : null;
  },
  'liveplanner:place': (m) =>
    isString(m.view) &&
    m.view.length >= 1 &&
    m.view.length <= REF_MAX_LENGTH &&
    isStringOrNull(m.folderId) &&
    isStringOrNull(m.folderName) &&
    isCountOrNull(m.projectCount) &&
    isStringOrNull(m.projectId) &&
    isStringOrNull(m.projectName) &&
    isStringOrNull(m.tabId) &&
    isStringOrNull(m.tabName) &&
    ROLES.includes(m.role)
      ? {
          type: 'liveplanner:place',
          v: 1,
          view: m.view,
          folderId: m.folderId,
          folderName: m.folderName,
          projectCount: m.projectCount,
          projectId: m.projectId,
          projectName: m.projectName,
          tabId: m.tabId,
          tabName: m.tabName,
          role: m.role as WorkbenchRole,
        }
      : null,
  'liveplanner:tab': (m) =>
    isString(m.tabId) && isString(m.tabName)
      ? { type: 'liveplanner:tab', v: 1, tabId: m.tabId, tabName: m.tabName }
      : null,
  'liveplanner:selection': (m) =>
    isString(m.projectId) &&
    isString(m.projectName) &&
    isString(m.tabId) &&
    isCount(m.rev) &&
    isCount(m.count) &&
    isString(m.reference)
      ? {
          type: 'liveplanner:selection',
          v: 1,
          projectId: m.projectId,
          projectName: m.projectName,
          tabId: m.tabId,
          rev: m.rev,
          count: m.count,
          reference: m.reference,
        }
      : null,
  'liveplanner:renew': () => ({ type: 'liveplanner:renew', v: 1 }),
  'liveplanner:ended': (m) =>
    REASONS.includes(m.reason)
      ? { type: 'liveplanner:ended', v: 1, reason: m.reason as WorkbenchEndReason }
      : null,
};

function openTargetOf(to: unknown): WorkbenchOpenTarget | null {
  if (typeof to !== 'object' || to === null) return null;
  const t = to as Fields;
  if (t.view === 'home') return { view: 'home' };
  if (isId(t.folderId)) return { folderId: t.folderId };
  if (!isId(t.projectId)) return null;
  if (t.tabId === undefined) return { projectId: t.projectId };
  return isId(t.tabId) ? { projectId: t.projectId, tabId: t.tabId } : null;
}

const TO_PAGE: Record<string, Parser> = {
  'liveplanner:open': (m) => {
    const to = openTargetOf(m.to);
    return to === null ? null : { type: 'liveplanner:open', v: 1, to };
  },
  'liveplanner:hello-ack': (m) => {
    const name = normaliseWorkbenchName(m.name);
    return name === null ? null : { type: 'liveplanner:hello-ack', v: 1, name };
  },
  'liveplanner:ticket': (m) =>
    isString(m.ticket) && WORKBENCH_HANDLE_PATTERN.test(m.ticket)
      ? { type: 'liveplanner:ticket', v: 1, ticket: m.ticket }
      : null,
  'liveplanner:reveal': (m) =>
    isRefList(m.refs) ? { type: 'liveplanner:reveal', v: 1, refs: [...m.refs] } : null,
  'liveplanner:theme': (m) =>
    SCHEMES.includes(m.colourScheme)
      ? {
          type: 'liveplanner:theme',
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
