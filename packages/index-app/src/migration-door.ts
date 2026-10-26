// The migration door's body (docs/migration.md "The apps' migration door"; @liveworkspace/migration contract.ts
// MigrationRoomPayload): checked field by field before anything reaches the item's Durable Object, so the room's
// write never binds a missing value or a wrong type. Pure.

import type {
  MigrationApp,
  MigrationChangeset,
  MigrationPersonPayload,
  MigrationPlanData,
  MigrationRoomPayload,
  MigrationShapeLibrary,
  MigrationTab,
} from '@liveworkspace/migration';

// The longest id the door takes (item, tab, changeset, image, sheet, item row, form code).
const MAX_ID = 200;
// A name's longest: the old site capped names far below this.
const MAX_NAME = 1000;

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_ID;
const isText = (v: unknown): v is string => typeof v === 'string';
const isTextOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const isIntOrNull = (v: unknown): v is number | null => v === null || isInt(v);
const isIdOrNull = (v: unknown): v is string | null => v === null || isId(v);

class Refusal extends Error {}
function need(ok: boolean, what: string): asserts ok {
  if (!ok) throw new Refusal(what);
}

function every<T>(v: unknown, what: string, check: (item: unknown, i: number) => T): T[] {
  need(Array.isArray(v), `${what} must be an array`);
  return (v as unknown[]).map(check);
}

function tabOf(v: unknown, i: number): MigrationTab {
  const at = `tabs[${i}]`;
  need(isRec(v), `${at} must be an object`);
  const t = v as Rec;
  need(isId(t.id), `${at}.id`);
  need(isText(t.name) && (t.name as string).length <= MAX_NAME, `${at}.name`);
  need(isInt(t.orderIndex), `${at}.orderIndex`);
  need(isTextOrNull(t.folder), `${at}.folder`);
  need(isInt(t.addedAt) && isInt(t.updatedAt), `${at} times`);
  need(isText(t.data) && (t.data as string).length > 0, `${at}.data`);
  need(isInt(t.elementCount) && (t.elementCount as number) >= 0, `${at}.elementCount`);
  return t as unknown as MigrationTab;
}

const PARTS = new Set(['ops', 'inverse', 'results']);

function changesetOf(v: unknown, i: number): MigrationChangeset {
  const at = `changesets[${i}]`;
  need(isRec(v), `${at} must be an object`);
  const c = v as Rec;
  need(isId(c.id) && isId(c.tabId), `${at} ids`);
  need(isInt(c.rev) && isInt(c.baseRev), `${at} revs`);
  for (const k of [
    'authorId',
    'authorName',
    'authorColor',
    'tokenId',
    'summary',
    'fingerprints',
    'revertOf',
  ])
    need(isTextOrNull(c[k]), `${at}.${k}`);
  for (const k of ['added', 'changed', 'removed', 'createdTab', 'createdAt'])
    need(isInt(c[k]), `${at}.${k}`);
  every(c.parts, `${at}.parts`, (part, j) => {
    need(
      isRec(part) && PARTS.has(String((part as Rec).part)) && isText((part as Rec).data),
      `${at}.parts[${j}]`,
    );
  });
  return c as unknown as MigrationChangeset;
}

function planOf(v: unknown): MigrationPlanData {
  need(isRec(v), 'plan must be an object');
  const p = v as Rec;
  need(isTextOrNull(p.itemTypes), 'plan.itemTypes');
  need(isInt(p.itemTypesRev) && isInt(p.itemsRev) && isInt(p.itemsNextKey), 'plan revs');
  every(p.items, 'plan.items', (it, i) => {
    const r = it as Rec;
    need(
      isRec(it) &&
        isId(r.id) &&
        isText(r.type) &&
        isInt(r.itemKey) &&
        isText(r.rank) &&
        isText(r.fields) &&
        isInt(r.rev) &&
        isInt(r.createdAt) &&
        isInt(r.updatedAt) &&
        isTextOrNull(r.createdBy) &&
        isTextOrNull(r.updatedBy),
      `plan.items[${i}]`,
    );
  });
  every(p.sheets, 'plan.sheets', (s, i) => {
    const r = s as Rec;
    need(
      isRec(s) &&
        isId(r.id) &&
        isId(r.tabId) &&
        isText(r.title) &&
        isText(r.layout) &&
        isInt(r.rev) &&
        isInt(r.createdAt) &&
        isInt(r.updatedAt) &&
        isTextOrNull(r.updatedBy),
      `plan.sheets[${i}]`,
    );
  });
  every(p.cells, 'plan.cells', (c, i) => {
    const r = c as Rec;
    need(
      isRec(c) &&
        isId(r.sheetId) &&
        isId(r.rowId) &&
        isId(r.colId) &&
        isTextOrNull(r.input) &&
        isTextOrNull(r.format),
      `plan.cells[${i}]`,
    );
  });
  every(p.formLinks, 'plan.formLinks', (f, i) => {
    const r = f as Rec;
    need(
      isRec(f) &&
        isId(r.code) &&
        isId(r.tabId) &&
        isInt(r.open) &&
        isInt(r.createdAt) &&
        isInt(r.responses) &&
        isIntOrNull(r.lastResponseAt) &&
        isIntOrNull(r.deletedAt),
      `plan.formLinks[${i}]`,
    );
  });
  return p as unknown as MigrationPlanData;
}

/** The door's body as a payload for this app and item, or what is wrong with it. */
export function parseMigrationPayload(
  body: unknown,
  app: MigrationApp,
  id: string,
): { ok: true; payload: MigrationRoomPayload } | { ok: false; error: string } {
  try {
    need(isRec(body), 'body must be a JSON object');
    const p = body as Rec;
    need(p.v === 1, 'v must be 1');
    need(p.app === app, `app must be ${app}`);
    need(p.id === id, 'id must be the path’s');
    need(isText(p.name) && (p.name as string).length <= MAX_NAME, 'name');
    need(isId(p.ownerId), 'ownerId');
    need(isIdOrNull(p.teamId), 'teamId');
    need(isInt(p.createdAt) && isInt(p.savedAt), 'times');
    need(isTextOrNull(p.source) && isTextOrNull(p.presentation), 'source or presentation');
    need(isTextOrNull(p.opensIn) && isTextOrNull(p.tabKind), 'opensIn or tabKind');
    const tabs = every(p.tabs, 'tabs', tabOf);
    need(new Set(tabs.map((t) => t.id)).size === tabs.length, 'tabs must not repeat an id');
    every(p.changesets, 'changesets', changesetOf);
    every(p.imageGrants, 'imageGrants', (g, i) => {
      need(
        isRec(g) && isId((g as Rec).imageId) && isInt((g as Rec).createdAt),
        `imageGrants[${i}]`,
      );
    });
    every(p.imageOwners, 'imageOwners', (o, i) => {
      need(isRec(o) && isId((o as Rec).imageId) && isText((o as Rec).owner), `imageOwners[${i}]`);
    });
    if (p.plan !== null) {
      need(app === 'liveplanner', 'plan is liveplanner’s alone');
      planOf(p.plan);
    }
    return { ok: true, payload: p as unknown as MigrationRoomPayload };
  } catch (err) {
    if (err instanceof Refusal) return { ok: false, error: err.message };
    throw err;
  }
}

function libraryOf(v: unknown, i: number): MigrationShapeLibrary {
  const at = `shapeLibraries[${i}]`;
  need(isRec(v), `${at} must be an object`);
  const l = v as Rec;
  need(isId(l.id), `${at}.id`);
  need(isText(l.name) && (l.name as string).length <= MAX_NAME, `${at}.name`);
  need(isText(l.source) && isText(l.items), `${at} source or items`);
  need(isInt(l.createdAt) && isInt(l.updatedAt), `${at} times`);
  return l as unknown as MigrationShapeLibrary;
}

/** The person door's body (docs/migration.md "The person migration door") for this app and person, or what is wrong
 *  with it. */
export function parseMigrationPersonPayload(
  body: unknown,
  app: MigrationApp,
  personId: string,
): { ok: true; payload: MigrationPersonPayload } | { ok: false; error: string } {
  try {
    need(isRec(body), 'body must be a JSON object');
    const p = body as Rec;
    need(p.v === 1, 'v must be 1');
    need(p.app === app, `app must be ${app}`);
    need(p.personId === personId, 'personId must be the path’s');
    const libraries = every(p.shapeLibraries, 'shapeLibraries', libraryOf);
    need(
      new Set(libraries.map((l) => l.id)).size === libraries.length,
      'shapeLibraries must not repeat an id',
    );
    return { ok: true, payload: p as unknown as MigrationPersonPayload };
  } catch (err) {
    if (err instanceof Refusal) return { ok: false, error: err.message };
    throw err;
  }
}

/** A payload with a tab over the app's tab cap: the door refuses the whole of it (413), naming the tab, since a part
 *  with a tab missing would read as complete. Thrown by the app's `migrate` handler in its worker, before the call
 *  to the item's Durable Object. */
export class MigrationTabTooLarge extends Error {
  readonly tabId: string;
  readonly bytes: number;
  readonly cap: number;
  constructor(tabId: string, bytes: number, cap: number) {
    super(`tab ${tabId} is ${bytes} bytes, over the tab cap of ${cap}`);
    this.name = 'MigrationTabTooLarge';
    this.tabId = tabId;
    this.bytes = bytes;
    this.cap = cap;
  }
}

// UTF-8 length without encoding the string (a 2 MB body is measured, not copied).
function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** Throws MigrationTabTooLarge for the first tab whose body is over `cap` bytes. */
export function checkMigrationTabSizes(payload: MigrationRoomPayload, cap: number): void {
  for (const tab of payload.tabs) {
    // Most tabs are far under: a character is at most 3 bytes in a body JSON stores (4 for a pair of two).
    if (tab.data.length * 3 <= cap) continue;
    const bytes = utf8Bytes(tab.data);
    if (bytes > cap) throw new MigrationTabTooLarge(tab.id, bytes, cap);
  }
}
