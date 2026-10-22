import { describe, expect, it } from 'vitest';
import { emptyLens, parseLens, type LensContext } from '@livediagram/explorer-lens';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { indexFolders } from '@/lib/folder-tree';
import { isLensSet, lensSubjectOf, narrowRows, scopeDocuments } from './pane-lens';

const NOW = Date.UTC(2026, 5, 15, 12);
const context: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const lensOf = (input: string) => parseLens(input, context).lens;

function doc(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    folderId: null as string | null,
    savedAt: NOW - 1000,
    shareCode: null,
    ownerId: 'me',
    ...over,
  };
}

describe('lensSubjectOf', () => {
  it('reads one of my own documents as mine, by me, with its recorded intent', () => {
    expect(
      lensSubjectOf(
        doc('a', { source: 'mcp', opensIn: 'draw', tabKind: 'diagram', templateFamily: 'kanban' }),
        'me',
      ),
    ).toMatchObject({
      space: 'mine',
      people: 'me',
      madeByAi: true,
      opensIn: 'draw',
      kind: null,
      template: 'kanban',
    });
  });

  it('reads a team row as that team, and its owner as others when it is not me', () => {
    const row = doc('t', { ownerId: 'sam', team: { id: 'T1', name: 'Acme' } });
    expect(lensSubjectOf(row, 'me')).toMatchObject({ space: 'team:T1', people: 'others' });
  });

  it('reads a team library row by its team id', () => {
    expect(lensSubjectOf(doc('t', { teamId: 'T1' }), 'me').space).toBe('team:T1');
  });

  it('reads a document in this browser as mine and made by me', () => {
    const row = doc('o', { ownerId: OFFLINE_OWNER_ID });
    expect(lensSubjectOf(row, 'me')).toMatchObject({ space: 'mine', people: 'me' });
  });

  it('reads a shared row as shared, by others, silent on provenance', () => {
    const row = doc('s', {
      ownerId: '',
      shared: { ownerName: 'Sam', role: 'view', shareCode: 'x' },
    });
    expect(lensSubjectOf(row, 'me')).toMatchObject({
      space: 'shared',
      people: 'others',
      madeByAi: null,
    });
  });

  it('reads a row without provenance as made by a person', () => {
    expect(lensSubjectOf(doc('p'), 'me').madeByAi).toBe(false);
  });
});

describe('scopeDocuments', () => {
  const { childrenByParent } = indexFolders([
    { id: 'f1', name: 'Projects', parentId: null },
    { id: 'f2', name: 'Acme', parentId: 'f1' },
    { id: 'f3', name: 'Archive', parentId: null },
  ]);
  const byFolder = new Map<string | null, ReturnType<typeof doc>[]>([
    [null, [doc('root', { savedAt: 1 })]],
    ['f1', [doc('in-projects', { savedAt: 3 })]],
    ['f2', [doc('in-acme', { savedAt: 2 })]],
    ['f3', [doc('in-archive', { savedAt: 4 })]],
  ]);

  it('reaches every subfolder of a folder, newest first', () => {
    expect(scopeDocuments('f1', childrenByParent, byFolder).map((d) => d.id)).toEqual([
      'in-projects',
      'in-acme',
    ]);
  });

  it('reaches the whole tree from the root', () => {
    expect(scopeDocuments(null, childrenByParent, byFolder).map((d) => d.id)).toEqual([
      'in-archive',
      'in-projects',
      'in-acme',
      'root',
    ]);
  });
});

describe('narrowRows', () => {
  const rows = [
    doc('Roadmap', { source: 'mcp' }),
    doc('Retro notes', { templateFamily: 'retrospective', opensIn: 'diagram', tabKind: 'diagram' }),
  ];

  it('keeps the rows the lens matches', () => {
    expect(narrowRows(rows, lensOf('made-by:ai'), 'me', NOW).map((d) => d.id)).toEqual(['Roadmap']);
    expect(narrowRows(rows, lensOf('retro'), 'me', NOW).map((d) => d.id)).toEqual(['Retro notes']);
  });

  it('keeps every row under the empty lens', () => {
    expect(narrowRows(rows, emptyLens(), 'me', NOW)).toHaveLength(2);
  });
});

describe('isLensSet', () => {
  it('is false for the empty lens and true once a word or a value is in it', () => {
    expect(isLensSet(emptyLens())).toBe(false);
    expect(isLensSet(lensOf('plan'))).toBe(true);
    expect(isLensSet(lensOf('edited:7d'))).toBe(true);
  });
});
