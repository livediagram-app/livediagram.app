import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { RoomOutgoing } from '@livediagram/api-schema';
import { applyRoomOpToTabs } from '../../app/document/[id]/room-op-apply';
import {
  createRemoteOpJournal,
  foldRemoteOpIntoBaseline,
  type SaveBaselineRefs,
} from '../../app/document/[id]/save-baseline';
import {
  prepareTabSave,
  saveTabAndRelay,
  type SaveRoom,
} from '../../app/document/[id]/tab-save-flow';
import { box, bytes, fakeApi, tabOf, withLabel, type Sent } from './tab-api-test-kit';

// A peer's save moves the base copy (docs/specs/006-document/delta-saves.md): two editors, each with its own copy of
// the editor's api binding (its own base copies), take turns editing one 2,000-element tab through the real save
// flow, the real room op derivation and the real baseline fold, over one stand-in api.

vi.mock('../guest-token', () => ({
  readGuestToken: () => ({ token: 'guest-jwt', id: 'guest_1', expiresAt: 1 }),
}));

vi.mock('../offline/offline-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offline/offline-store')>()),
  isOfflineId: vi.fn(async (id: string) => id.startsWith('local-')),
  isOfflineIdSync: vi.fn((id: string) => id.startsWith('local-')),
}));

type Calls = typeof import('./tabs');

// One editor: its own module copy of the api binding, the tab on screen and its autosave's baseline.
async function editor(): Promise<{
  calls: Calls;
  screen: Tab[];
  baseline: SaveBaselineRefs;
}> {
  vi.resetModules();
  const calls = await import('./tabs');
  return {
    calls,
    screen: [],
    baseline: {
      tabs: { current: [] },
      name: { current: 'Doc' },
      journal: { current: createRemoteOpJournal() },
    },
  };
}

type Editor = Awaited<ReturnType<typeof editor>>;

let api: ReturnType<typeof fakeApi>;
beforeEach(() => {
  api = fakeApi();
  vi.stubGlobal('fetch', api.fetch);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let n = 0;
const docId = () => `peers${++n}`;

// The room: what one editor sends reaches the other, in order, as receiveRoomOp applies it (the tab on screen and
// the baseline), a `tab-saved` going to the receiver's adoption as useEditorRoom hands it on.
async function deliver(to: Editor, documentId: string, sent: RoomOutgoing[]): Promise<void> {
  for (const msg of sent) {
    if (msg.kind !== 'op') continue;
    const op = msg.op;
    if (op.kind === 'tab-saved') {
      const tab = to.baseline.tabs.current.find((t) => t.id === op.tabId)!;
      await to.calls.apiAdoptPeerSave(documentId, tab, op.rev, op.digest);
      continue;
    }
    to.screen = applyRoomOpToTabs(to.screen, op);
    foldRemoteOpIntoBaseline(to.baseline, op);
  }
}

// One autosave of the tab on screen, as useAutosaveCore runs it: derive the ops at the snapshot, save, relay, and
// (with `announce`) say what was stored. Answers what reached the room.
async function save(
  from: Editor,
  documentId: string,
  announce: boolean,
): Promise<{ relayed: RoomOutgoing[] }> {
  const tab = from.screen[0]!;
  const before = from.baseline.tabs.current.find((t) => t.id === tab.id);
  const relayed: RoomOutgoing[] = [];
  const room: SaveRoom = {
    send: (msg) => relayed.push(msg),
    sequence: async (op) => {
      relayed.push({ kind: 'op', op });
      return true;
    },
  };
  await saveTabAndRelay(
    before,
    tab,
    () => room,
    () => from.calls.apiSaveTab('guest_1', documentId, tab, null, { allowEmpty: true }),
    prepareTabSave(before, tab),
    announce ? (tabId, rev) => from.calls.apiSavedTabDigest(tabId, rev) : undefined,
  );
  from.baseline.tabs.current = from.screen;
  return { relayed };
}

const kindOf = (s: Sent) => (s.url.endsWith('/delta') ? 'delta' : `${s.method} whole`);

// Two editors on one stored 2,000-element tab, both loaded.
async function twoEditorsOnABigTab(): Promise<{ a: Editor; b: Editor; documentId: string }> {
  const documentId = docId();
  const a = await editor();
  const b = await editor();
  const seed = tabOf(Array.from({ length: 2000 }, (_, i) => box(i)));
  await a.calls.apiSaveTab('guest_1', documentId, seed, null, { allowEmpty: true });
  for (const e of [a, b]) {
    const loaded = (await e.calls.apiLoadTabRevisioned('guest_1', documentId, 't1', null))!;
    e.screen = [loaded.tab];
    e.baseline.tabs.current = [loaded.tab];
  }
  return { a, b, documentId };
}

// Six alternating one-label edits, A then B, each on its own element; every save's request and size.
async function alternate(announce: boolean) {
  const { a, b, documentId } = await twoEditorsOnABigTab();
  const saves: { who: string; kind: string; bytes: number }[] = [];
  for (let round = 0; round < 6; round++) {
    const [from, to, who] = round % 2 === 0 ? [a, b, 'A'] : [b, a, 'B'];
    from.screen = [withLabel(from.screen[0]!, round * 7, `Edit ${round}`)];
    const firstSent = api.sent.length;
    const { relayed } = await save(from, documentId, announce);
    const requests = api.sent.slice(firstSent);
    saves.push({
      who,
      kind: requests.map(kindOf).join(' + '),
      bytes: requests.reduce((sum, s) => sum + bytes(s), 0),
    });
    await deliver(to, documentId, relayed);
  }
  // Both editors converged on what the api stores.
  const stored = api.store.get('t1')!.tab.elements;
  expect(JSON.stringify(a.screen[0]!.elements)).toBe(JSON.stringify(stored));
  expect(JSON.stringify(b.screen[0]!.elements)).toBe(JSON.stringify(stored));
  return saves;
}

describe("a peer's save moves the base copy", () => {
  it('two editors alternating small edits on a 2,000-element tab both send deltas', async () => {
    const saves = await alternate(true);
    expect(saves.map((s) => s.kind)).toEqual(Array(6).fill('delta'));
    // Each save is one small delta, well under a kilobyte, against a whole tab of about 265 KB.
    for (const s of saves) expect(s.bytes).toBeLessThan(1024);
  });

  it('without the announcement every save after the first is a refused delta and the whole tab', async () => {
    const saves = await alternate(false);
    expect(saves.map((s) => s.kind)).toEqual(['delta', ...Array(5).fill('delta + PUT whole')]);
    for (const s of saves.slice(1)) expect(s.bytes).toBeGreaterThan(200_000);
  });

  it('a peer whose baseline differs from what was stored moves nothing, and its next save still lands', async () => {
    const { a, b, documentId } = await twoEditorsOnABigTab();
    a.screen = [withLabel(a.screen[0]!, 3, 'From A')];
    const { relayed } = await save(a, documentId, true);
    // B never got A's element op (a gap), only the announcement: its baseline is not what was stored.
    await deliver(
      b,
      documentId,
      relayed.filter((m) => m.kind === 'op' && m.op.kind === 'tab-saved'),
    );
    b.screen = [withLabel(b.screen[0]!, 9, 'From B')];
    const firstSent = api.sent.length;
    await save(b, documentId, true);
    expect(api.sent.slice(firstSent).map(kindOf)).toEqual(['delta', 'PUT whole']);
  });
});
