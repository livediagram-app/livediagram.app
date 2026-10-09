// What a room op means to `wait` and `watch` (docs/specs/015-api/blueprints/cli.md "The room stream", CLI33): each
// op the room relays becomes zero or more events, and each event one line. Pure: the names and refs a line needs
// are looked up by the caller.

import type { ChangesetCounts } from '@livediagram/api-schema';
import { isRecord } from '@livediagram/document';
import { oneLine } from '../output/one-line';

export type RoomEvent =
  | { kind: 'comment'; tabId: string; elementId: string; authorName: string; text: string }
  | {
      kind: 'changeset';
      tabId: string;
      id: string;
      author: string;
      summary: string | null;
      counts: ChangesetCounts;
    }
  | { kind: 'element'; tabId: string; elementId: string; change: 'added' | 'changed' | 'removed' }
  | { kind: 'tab'; tabId: string }
  | { kind: 'document'; name: string; tabs: { id: string; name: string }[] };

const str = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' ? value : null;
};

const num = (record: Record<string, unknown>, key: string): number =>
  typeof record[key] === 'number' ? record[key] : 0;

function changesetEvent(op: Record<string, unknown>, tabId: string): RoomEvent[] {
  const id = str(op, 'id');
  const author = isRecord(op.author) ? str(op.author, 'name') : null;
  const counts = isRecord(op.counts) ? op.counts : {};
  if (id === null) return [];
  return [
    {
      kind: 'changeset',
      tabId,
      id,
      author: author ?? 'someone',
      summary: str(op, 'summary'),
      counts: {
        added: num(counts, 'added'),
        changed: num(counts, 'changed'),
        removed: num(counts, 'removed'),
      },
    },
  ];
}

const ELEMENT_CHANGES = { add: 'added', update: 'changed', remove: 'removed' } as const;

function elementEvent(op: unknown, tabId: string): RoomEvent[] {
  if (!isRecord(op)) return [];
  const kind = str(op, 'kind');
  if (kind === 'reorder') return [{ kind: 'tab', tabId }];
  if (kind !== 'add' && kind !== 'update' && kind !== 'remove') return [];
  const elementId =
    kind === 'remove' ? str(op, 'id') : isRecord(op.element) ? str(op.element, 'id') : null;
  return elementId === null
    ? []
    : [{ kind: 'element', tabId, elementId, change: ELEMENT_CHANGES[kind] }];
}

// One comment change, an answer, an idea or a tick on one element. Only a new comment is a comment event; a comment
// removed, re-keyed, resolved or reopened is neither a comment nor a change (blueprint "The room stream").
function deltaEvent(op: Record<string, unknown>, tabId: string): RoomEvent[] {
  const elementId = str(op, 'elementId');
  const delta = isRecord(op.delta) ? op.delta : null;
  const kind = delta ? str(delta, 'kind') : null;
  if (elementId === null || delta === null || kind === null) return [];
  if (kind === 'comment-add') {
    const comment = isRecord(delta.comment) ? delta.comment : {};
    return [
      {
        kind: 'comment',
        tabId,
        elementId,
        authorName: str(comment, 'authorName') ?? 'someone',
        text: str(comment, 'text') ?? '',
      },
    ];
  }
  if (kind.startsWith('comment-')) return [];
  return [{ kind: 'element', tabId, elementId, change: 'changed' }];
}

function documentEvent(op: Record<string, unknown>): RoomEvent[] {
  const name = str(op, 'name');
  if (name === null || !Array.isArray(op.tabs)) return [];
  const tabs = op.tabs.flatMap((t: unknown) => {
    if (!isRecord(t)) return [];
    const id = str(t, 'id');
    const tabName = str(t, 'name');
    return id === null || tabName === null ? [] : [{ id, name: tabName }];
  });
  return [{ kind: 'document', name, tabs }];
}

export function classifyRoomOp(op: unknown): RoomEvent[] {
  if (!isRecord(op)) return [];
  const kind = str(op, 'kind');
  if (kind === 'document-meta') return documentEvent(op);
  const tabId = str(op, 'tabId');
  if (tabId === null) return [];
  switch (kind) {
    case 'changeset':
      return changesetEvent(op, tabId);
    case 'el':
      return elementEvent(op.op, tabId);
    case 'el-delta':
      return deltaEvent(op, tabId);
    case 'vote': {
      const elementId = str(op, 'elementId');
      return elementId === null ? [] : [{ kind: 'element', tabId, elementId, change: 'changed' }];
    }
    case 'tab':
    case 'tab-meta':
    case 'article':
      return [{ kind: 'tab', tabId }];
    default:
      return [];
  }
}

// Whether an event is on the tab a command was narrowed to; a document event concerns every tab.
export function onTab(event: RoomEvent, tabId: string | null): boolean {
  return tabId === null || event.kind === 'document' || event.tabId === tabId;
}

// What `watch` needs to name things: a tab's name, an element's ref on its tab, and the document's tabs as last
// seen (to tell a tab added, renamed or removed).
export type Names = {
  tabName(tabId: string): string;
  refOf(tabId: string, elementId: string): string;
  tabs: readonly { id: string; name: string }[];
  documentName: string;
};

const quoted = (text: string) => JSON.stringify(text);

function documentLines(event: Extract<RoomEvent, { kind: 'document' }>, names: Names): string[] {
  const before = new Map(names.tabs.map((t) => [t.id, t.name] as const));
  const after = new Map(event.tabs.map((t) => [t.id, t.name] as const));
  const lines: string[] = [];
  if (event.name !== names.documentName) lines.push(`document renamed ${quoted(event.name)}`);
  for (const [id, name] of after) {
    const was = before.get(id);
    if (was === undefined) lines.push(`tab ${quoted(name)} added`);
    else if (was !== name) lines.push(`tab ${quoted(name)} renamed`);
  }
  for (const [id, name] of before) if (!after.has(id)) lines.push(`tab ${quoted(name)} removed`);
  return lines;
}

// `watch`'s lines for one event (CLI33).
export function watchLines(event: RoomEvent, names: Names): string[] {
  switch (event.kind) {
    case 'changeset': {
      const { added, changed, removed } = event.counts;
      const summary = event.summary ? ` ${quoted(event.summary)}` : '';
      return [
        `changeset ${event.id} by ${oneLine(event.author)}:${summary} (+${added} ~${changed} -${removed})`,
      ];
    }
    case 'comment':
      return [
        `comment on ${names.refOf(event.tabId, event.elementId)} by ${oneLine(event.authorName)}: ${quoted(event.text)}`,
      ];
    case 'element':
      return [`element ${names.refOf(event.tabId, event.elementId)} ${event.change}`];
    case 'tab':
      return [`tab ${quoted(names.tabName(event.tabId))} changed`];
    case 'document':
      return documentLines(event, names);
  }
}
