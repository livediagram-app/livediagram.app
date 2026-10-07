import { describe, expect, it } from 'vitest';
import {
  coverageOf,
  fixtureDoc,
  readableFact,
  trackedFile,
  type FixtureDoc,
} from '../testing/sync-fixtures';
import type { ScannedFile } from './mirror-scan';
import type { RemoteFact } from './remote';
import { planSync, type PlanInput } from './sync-plan';

// Planning a pass (docs/specs/027-repositories/blueprints/repository-link.md "Actions"): one action per document
// and per refused or reported file.

const home = fixtureDoc('d-home', 'Home', [3]);
const zeta = fixtureDoc('d-zeta', 'Zeta', [1, 2]);
const facts = (...docs: FixtureDoc[]) => new Map(docs.map((d) => [d.id, readableFact(d)]));

const plan = (over: Partial<PlanInput>) =>
  planSync({
    level: 'files',
    scan: [],
    coverage: coverageOf([home, zeta]),
    remote: facts(home, zeta),
    recorded: {},
    scope: null,
    ...over,
  });

describe('planSync at files', () => {
  it('writes new documents at fresh paths in index order, and leaves in-step ones', async () => {
    const { actions, states } = plan({
      scan: [await trackedFile(zeta, 'zeta.livediagram.json')],
      coverage: coverageOf([{ ...zeta }, { ...home, folderPath: ['screens'] }]),
    });
    expect(actions).toEqual([
      { kind: 'none', documentId: 'd-zeta', name: 'Zeta', path: 'zeta.livediagram.json' },
      {
        kind: 'write',
        documentId: 'd-home',
        name: 'Home',
        reason: 'new',
        path: 'screens/home.livediagram.json',
        tabs: [{ id: 'd-home-t1', name: 'Tab 1', from: null, to: 3 }],
      },
    ]);
    expect(states).toEqual(
      new Map([
        ['d-zeta', 'in-step'],
        ['d-home', 'new'],
      ]),
    );
  });

  it('writes a behind document at its stable path, and names a path that would now differ', async () => {
    const renamed = { ...fixtureDoc('d-home', 'Home screen', [4]) };
    const { actions } = plan({
      scan: [await trackedFile(home, 'home.livediagram.json')],
      coverage: coverageOf([renamed]),
      remote: facts(renamed),
    });
    expect(actions).toEqual([
      {
        kind: 'relocate',
        documentId: 'd-home',
        name: 'Home screen',
        path: 'home.livediagram.json',
        to: 'home-screen.livediagram.json',
      },
      {
        kind: 'write',
        documentId: 'd-home',
        name: 'Home screen',
        reason: 'behind',
        path: 'home.livediagram.json',
        tabs: [{ id: 'd-home-t1', name: 'Tab 1', from: 3, to: 4 }],
      },
    ]);
  });

  it('steps a new document aside for a path another file holds', async () => {
    const twin = fixtureDoc('d-twin', 'Home', [1]);
    const { actions } = plan({
      scan: [await trackedFile(home, 'home.livediagram.json')],
      coverage: coverageOf([home, twin]),
      remote: facts(home, twin),
    });
    expect(actions.find((a) => a.documentId === 'd-twin')).toMatchObject({
      kind: 'write',
      path: 'home-d-twin.livediagram.json',
    });
  });

  it('refuses ahead and diverged documents naming their file, and the rest proceeds', async () => {
    const moved = fixtureDoc('d-zeta', 'Zeta', [1, 3]);
    const { actions } = plan({
      scan: [
        await trackedFile(home, 'home.livediagram.json', true),
        await trackedFile(zeta, 'zeta.livediagram.json', true),
      ],
      remote: facts(home, moved),
    });
    expect(actions).toEqual([
      {
        kind: 'refuse',
        documentId: 'd-home',
        path: 'home.livediagram.json',
        reason: 'ahead',
        detail: null,
      },
      {
        kind: 'refuse',
        documentId: 'd-zeta',
        path: 'zeta.livediagram.json',
        reason: 'diverged',
        detail: null,
      },
    ]);
  });

  it('removes a gone document’s files, keeps a changed one refused, and reports an unreadable one', async () => {
    const trashed: RemoteFact = { kind: 'trashed' };
    const other = fixtureDoc('d-other', 'Other', [1]);
    const { actions } = plan({
      scan: [
        await trackedFile(home, 'home.livediagram.json'),
        await trackedFile(zeta, 'zeta.livediagram.json', true),
        await trackedFile(other, 'other.livediagram.json'),
      ],
      coverage: coverageOf([home]),
      remote: new Map<string, RemoteFact>([
        ['d-home', trashed],
        ['d-zeta', readableFact(zeta)],
        ['d-other', { kind: 'unreadable' }],
      ]),
    });
    expect(actions).toEqual([
      {
        kind: 'remove',
        documentId: 'd-home',
        name: 'Home',
        path: 'home.livediagram.json',
        reason: 'trashed',
      },
      {
        kind: 'report',
        reason: 'unreadable',
        documentId: 'd-other',
        path: 'other.livediagram.json',
      },
      {
        kind: 'refuse',
        documentId: 'd-zeta',
        path: 'zeta.livediagram.json',
        reason: 'gone-changed',
        detail: null,
      },
    ]);
  });

  it('judges nothing outside coverage when the covered folder was unreadable (RL6)', async () => {
    const { actions } = plan({
      scan: [await trackedFile(zeta, 'zeta.livediagram.json')],
      coverage: coverageOf([home], { id: 'f1', found: false }),
    });
    expect(actions.map((a) => [a.kind, a.documentId])).toEqual([
      ['write', 'd-home'],
      ['none', 'd-zeta'],
    ]);
  });

  it('keeps a transient failure’s files, and an unreadable covered document without a file reported by id', () => {
    const { actions } = plan({
      remote: new Map<string, RemoteFact>([
        [
          'd-home',
          { kind: 'transient', failure: 'could not reach x (network)', exit: 7, reason: 'network' },
        ],
        ['d-zeta', { kind: 'unreadable' }],
      ]),
    });
    expect(actions).toEqual([
      {
        kind: 'transient',
        documentId: 'd-home',
        name: 'Home',
        failure: 'could not reach x (network)',
        exit: 7,
        reason: 'network',
      },
      { kind: 'report', reason: 'unreadable', documentId: 'd-zeta', path: null },
    ]);
  });

  it('refuses or reports every other file class, and writes no third file for a duplicated document', async () => {
    const scan: ScannedFile[] = [
      { class: 'conflicted', path: 'a.livediagram.json' },
      { class: 'invalid', path: 'b.livediagram.json', message: 'not JSON' },
      { class: 'local-new', path: 'c.livediagram.json', documentId: 'd-new', name: 'New' },
      { class: 'foreign-host', path: 'd.livediagram.json', host: 'https://self.example' },
      {
        class: 'duplicate',
        path: 'e.livediagram.json',
        documentId: 'd-home',
        other: 'f.livediagram.json',
      },
      {
        class: 'duplicate',
        path: 'f.livediagram.json',
        documentId: 'd-home',
        other: 'e.livediagram.json',
      },
    ];
    const { actions } = plan({ scan, coverage: coverageOf([home]), remote: facts(home) });
    expect(actions).toEqual([
      {
        kind: 'refuse',
        documentId: null,
        path: 'a.livediagram.json',
        reason: 'conflicted',
        detail: null,
      },
      {
        kind: 'refuse',
        documentId: null,
        path: 'b.livediagram.json',
        reason: 'invalid',
        detail: 'not JSON',
      },
      { kind: 'report', reason: 'local-new', documentId: null, path: 'c.livediagram.json' },
      {
        kind: 'refuse',
        documentId: null,
        path: 'd.livediagram.json',
        reason: 'foreign-host',
        detail: 'https://self.example',
      },
      {
        kind: 'refuse',
        documentId: 'd-home',
        path: 'e.livediagram.json',
        reason: 'duplicate',
        detail: 'f.livediagram.json',
      },
      {
        kind: 'refuse',
        documentId: 'd-home',
        path: 'f.livediagram.json',
        reason: 'duplicate',
        detail: 'e.livediagram.json',
      },
    ]);
  });

  it('acts on the narrowed documents and files only, and on nothing without an answer', async () => {
    const scan: ScannedFile[] = [
      await trackedFile(zeta, 'zeta.livediagram.json', true),
      { class: 'conflicted', path: 'a.livediagram.json' },
    ];
    const narrowed = plan({
      scan,
      remote: facts(home),
      scope: { documents: new Set(['d-home']), paths: new Set() },
    });
    expect(narrowed.actions.map((a) => [a.kind, a.documentId])).toEqual([['write', 'd-home']]);
    const byPath = plan({
      scan,
      remote: facts(zeta),
      scope: { documents: new Set(), paths: new Set(['zeta.livediagram.json']) },
    });
    expect(byPath.actions.map((a) => [a.kind, 'path' in a ? a.path : null])).toEqual([
      ['refuse', 'zeta.livediagram.json'],
    ]);
  });
});

describe('planSync at index and none', () => {
  const recorded = {
    'd-home': { name: 'Home', tabs: { 'd-home-t1': { rev: 2, syncedAt: 1 } } },
    'd-gone': { name: 'Gone', tabs: {} },
  };

  it('decides from the recorded documents, and lowers the files the level keeps no more', async () => {
    const { actions } = plan({
      level: 'index',
      scan: [
        await trackedFile(zeta, 'zeta.livediagram.json'),
        await trackedFile(home, 'home.livediagram.json', true),
      ],
      recorded,
      remote: new Map<string, RemoteFact>([...facts(home, zeta), ['d-gone', { kind: 'trashed' }]]),
    });
    expect(actions).toEqual([
      { kind: 'remove', documentId: 'd-gone', name: 'Gone', path: null, reason: 'trashed' },
      {
        kind: 'write',
        documentId: 'd-home',
        name: 'Home',
        reason: 'behind',
        path: null,
        tabs: [{ id: 'd-home-t1', name: 'Tab 1', from: 2, to: 3 }],
      },
      {
        kind: 'write',
        documentId: 'd-zeta',
        name: 'Zeta',
        reason: 'new',
        path: null,
        tabs: [
          { id: 'd-zeta-t1', name: 'Tab 1', from: null, to: 1 },
          { id: 'd-zeta-t2', name: 'Tab 2', from: null, to: 2 },
        ],
      },
      { kind: 'lower', documentId: 'd-zeta', name: 'Zeta', path: 'zeta.livediagram.json' },
      {
        kind: 'refuse',
        documentId: 'd-home',
        path: 'home.livediagram.json',
        reason: 'lowered-changed',
        detail: 'index',
      },
    ]);
  });

  it('drops nothing for a document never synced here that is gone', () => {
    const { actions } = plan({
      level: 'none',
      coverage: coverageOf([home]),
      remote: new Map<string, RemoteFact>([['d-home', { kind: 'trashed' }]]),
    });
    expect(actions).toEqual([]);
  });
});

describe('the index order', () => {
  it('compares folder paths segment by segment, a prefix first', () => {
    const docs = [
      { ...fixtureDoc('d-1', 'A'), folderPath: ['b'] },
      { ...fixtureDoc('d-2', 'A'), folderPath: ['a', 'z'] },
      { ...fixtureDoc('d-3', 'A'), folderPath: ['a'] },
      { ...fixtureDoc('d-4', 'A'), folderPath: ['a', 'b'] },
    ];
    const { actions } = plan({ coverage: coverageOf(docs), remote: facts(...docs) });
    expect(actions.map((a) => a.documentId)).toEqual(['d-3', 'd-4', 'd-2', 'd-1']);
  });
});

describe('a listed document no library names', () => {
  it('is ordered and reported by its id', () => {
    const coverage = coverageOf([home]);
    coverage.documents.push({ ...coverage.documents[0]!, id: 'd-listed', name: null });
    const { actions } = plan({
      coverage,
      remote: new Map<string, RemoteFact>([...facts(home), ['d-listed', { kind: 'unreadable' }]]),
    });
    expect(actions.map((a) => a.documentId)).toEqual(['d-home', 'd-listed']);
  });
});
