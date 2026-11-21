// What a restore writes and what the room hears of it (docs/specs/006-document/version-history.md "Restore"; blueprint
// VH14, VH16). Pure.
import { tabArticleOps, type RoomOp } from '@liveknowledge/api-schema';
import {
  LIVE_ELEMENT_FIELDS,
  migrateIncomingTab,
  migrateStoredTab,
  pageStepsOf,
  type Element,
  type Tab,
  withoutDraft,
} from '@liveknowledge/document';

// A stored body: the tab without its id and name, which live in their own columns (tab-row.ts).
export type VersionBody = Omit<Tab, 'id' | 'name'>;

// The fields that are the tab's, not its content: a restore leaves them as they are, and a body never carries them
// to the room. `elements` and `articles` travel as their own ops.
const NOT_CONTENT = new Set([
  'id',
  'name',
  'locked',
  'folder',
  'connection',
  'elements',
  'articles',
]);

// A version's stored body, settled as every tab read settles one; null when it no longer parses as a tab body.
// No version keeps a draft (docs/specs/006-document/version-history.md): a copy taken of a tab while its draft was
// open (an agent's version, Name This Version) holds one in its stored body, so the body is read without it, and a
// Viewer looking at, copying or restoring a version never meets the draft's writing
// (docs/specs/030-knowledgebase/editing.md "Share roles").
export function parseVersionBody(data: string): VersionBody | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Tab).elements)) {
      return null;
    }
    return withoutDraft(migrateStoredTab(parsed as VersionBody));
  } catch {
    return null;
  }
}

// The tab a restore writes: the version's body under the stored tab's id, name and lock, every element both have
// keeping its current conversation (LIVE_ELEMENT_FIELDS), so a restore never deletes a comment on what it keeps.
export function restoredTab(stored: Tab, body: VersionBody): Tab {
  const live = new Map<string, Element>(stored.elements.map((e) => [e.id, e]));
  const elements = body.elements.map((element) => {
    const now = live.get(element.id);
    if (!now) return element;
    const kept: Record<string, unknown> = { ...element };
    for (const field of LIVE_ELEMENT_FIELDS) {
      const value = (now as Record<string, unknown>)[field];
      if (value === undefined) delete kept[field];
      else kept[field] = value;
    }
    return kept as Element;
  });
  const { locked: _locked, folder: _folder, ...rest } = body as VersionBody & { folder?: string };
  const next = { ...rest, elements, id: stored.id, name: stored.name } as Tab;
  if (stored.locked) next.locked = stored.locked;
  return migrateIncomingTab(next) as Tab;
}

// Whether two tabs hold the same content: what a restore would change, apart from the tab's own fields.
export function sameContent(a: Tab, b: Tab): boolean {
  return contentJson(a) === contentJson(b);
}

function contentJson(tab: Tab): string {
  const entries = Object.entries(tab)
    .filter(([key, value]) => !NOT_CONTENT.has(key) && value !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return JSON.stringify([entries, tab.elements, tab.articles ?? null]);
}

// The ops an editor needs beside the changeset's element ops (VH16): one `tab-meta` patch of every other content
// field that differs (cleared when the version lacks it), the pages' steps when the pages differ, then the article
// writing block by block, as an agent's page change sends them.
export function restoreRoomOps(before: Tab, after: Tab): RoomOp[] {
  const patch: Record<string, unknown> = {};
  const clear: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) {
    if (NOT_CONTENT.has(key)) continue;
    const was = (before as Record<string, unknown>)[key];
    const now = (after as Record<string, unknown>)[key];
    if (JSON.stringify(was) === JSON.stringify(now)) continue;
    if (now === undefined) clear.push(key);
    else patch[key] = now;
  }
  const ops: RoomOp[] = [];
  if (Object.keys(patch).length > 0 || clear.length > 0) {
    const pageSteps = 'pages' in patch || clear.includes('pages') ? pageStepsOf(before, after) : [];
    ops.push({
      kind: 'tab-meta',
      tabId: after.id,
      patch,
      ...(clear.length ? { clear } : {}),
      ...(pageSteps.length ? { pageSteps } : {}),
    });
  }
  ops.push(...tabArticleOps(before, after, { grow: true }));
  return ops;
}
