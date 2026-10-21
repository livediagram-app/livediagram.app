import { describe, expect, it } from 'vitest';
import type { OverviewView } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import { tabHashes } from '../sync/pull-file';
import type { MirrorFile } from './mirror-file';
import type { TabHashes } from './mirror-scan';
import type { EnvelopeFields, RemoteFact } from './remote';
import { envelopeDiffers, isLocallyChanged, syncStateOf } from './sync-state';

// Sync states (docs/specs/027-repositories/blueprints/repository-link.md "Sync states"): one row per state.

const tab = (id: string, label: string): Tab => ({
  id,
  name: `Tab ${id}`,
  elements: [{ id: 'e', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1, label }],
});

async function tracked(tabs: Tab[] = [tab('t1', 'A'), tab('t2', 'B')]) {
  const recorded: MirrorFile['livediagramSync']['tabs'] = {};
  const hashes: TabHashes = {};
  for (const [i, t] of tabs.entries()) {
    hashes[t.id] = await tabHashes(t);
    recorded[t.id] = { rev: i + 1, ...hashes[t.id]! };
  }
  const file: MirrorFile = {
    kind: 'livediagram.document',
    schemaVersion: 1,
    document: { id: 'd1', name: 'Home', presentation: null, tabs },
    livediagramSync: { host: 'https://livediagram.app', tabs: recorded },
  };
  return { file, hashes };
}

const facts = (id: string, rev: number) => ({
  view: 'overview' as const,
  outOfScope: false as const,
  tab: { id, ref: id, name: `Tab ${id}`, kind: 'diagram' as const },
  elements: 1,
  counts: { boxes: 1, frames: 0, lanes: 0, arrows: 0 },
  hidden: 0,
  unknown: 0,
  threads: { open: 0, total: 0 },
  rev,
});

const envelope = (over: Partial<EnvelopeFields> = {}): EnvelopeFields => ({
  name: 'Home',
  presentation: null,
  tabs: [
    { id: 't1', orderIndex: 0 },
    { id: 't2', orderIndex: 1 },
  ],
  ...over,
});

function readable(
  revs: [string, number][] = [
    ['t1', 1],
    ['t2', 2],
  ],
  env = envelope(),
): RemoteFact {
  const overview: OverviewView = {
    document: { id: 'd1', name: env.name, savedAt: 0, tabs: revs.length },
    tabs: [...revs.map(([id, rev]) => facts(id, rev)), { outOfScope: true, ref: 'x' }],
    elision: null,
  };
  return { kind: 'readable', overview, envelope: env };
}

describe('syncStateOf', () => {
  it('decides every state of the table', async () => {
    const clean = await tracked();
    const changed = await tracked();
    changed.hashes.t1 = { ...changed.hashes.t1!, hash: 'edited' };
    const transient: RemoteFact = { kind: 'transient', failure: 'x', exit: 7, reason: 'network' };
    const rows: [Awaited<ReturnType<typeof tracked>>, RemoteFact, boolean | null, string][] = [
      [clean, readable(), true, 'in-step'],
      [clean, readable(), null, 'in-step'],
      [
        clean,
        readable([
          ['t1', 1],
          ['t2', 3],
        ]),
        true,
        'behind',
      ],
      [changed, readable(), true, 'ahead'],
      [
        changed,
        readable([
          ['t1', 2],
          ['t2', 2],
        ]),
        true,
        'diverged',
      ],
      [clean, readable(), false, 'gone'],
      [changed, { kind: 'trashed' }, true, 'gone'],
      [clean, { kind: 'unreadable' }, true, 'unreadable'],
      [clean, transient, true, 'transient'],
    ];
    for (const [file, remote, covered, state] of rows)
      expect(syncStateOf({ ...file, remote, covered }).state, state).toBe(state);
  });

  it('reads a tab added, a tab removed or a changed setting as a local change', async () => {
    const { file, hashes } = await tracked();
    expect(isLocallyChanged(file, hashes)).toBe(false);
    expect(isLocallyChanged(file, { ...hashes, t3: hashes.t1! })).toBe(true);
    const { t2: _t2, ...fewer } = hashes;
    expect(isLocallyChanged(file, fewer)).toBe(true);
    expect(isLocallyChanged(file, { ...hashes, t2: { ...hashes.t2!, settingsHash: 'x' } })).toBe(
      true,
    );
  });

  it('reads a tab added or removed in livediagram as a remote change', async () => {
    const clean = await tracked();
    const added = readable([
      ['t1', 1],
      ['t2', 2],
      ['t3', 1],
    ]);
    expect(syncStateOf({ ...clean, remote: added, covered: true }).state).toBe('behind');
    const removed = readable([['t1', 1]], envelope({ tabs: [{ id: 't1', orderIndex: 0 }] }));
    expect(syncStateOf({ ...clean, remote: removed, covered: true }).state).toBe('behind');
  });

  it('makes a rename, a deck, a reorder or a refiled tab behind (RL37)', async () => {
    const clean = await tracked();
    const behind = (env: EnvelopeFields) =>
      syncStateOf({ ...clean, remote: readable(undefined, env), covered: true }).state;
    expect(behind(envelope({ name: 'Renamed' }))).toBe('behind');
    expect(behind(envelope({ presentation: '{}' }))).toBe('behind');
    expect(
      behind(
        envelope({
          tabs: [
            { id: 't1', orderIndex: 1 },
            { id: 't2', orderIndex: 0 },
          ],
        }),
      ),
    ).toBe('behind');
    expect(
      behind(
        envelope({
          tabs: [
            { id: 't1', orderIndex: 0, folder: 'Later' },
            { id: 't2', orderIndex: 1 },
          ],
        }),
      ),
    ).toBe('behind');
    const readWithout: RemoteFact = { ...readable(), envelope: null } as RemoteFact;
    expect(syncStateOf({ ...clean, remote: readWithout, covered: true }).state).toBe('in-step');
  });
});

describe('envelopeDiffers', () => {
  it('reads an absent folder as none', async () => {
    const { file } = await tracked();
    file.document.tabs[0]!.folder = 'Core';
    expect(
      envelopeDiffers(
        file,
        envelope({
          tabs: [
            { id: 't1', orderIndex: 0, folder: 'Core' },
            { id: 't2', orderIndex: 1 },
          ],
        }),
      ),
    ).toBe(false);
  });
});
