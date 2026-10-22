import { describe, expect, it } from 'vitest';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import {
  buildDefaultFolderIndex,
  destinationOf,
  folderDefaultKeys,
  representativeIntent,
  resolveDefaultFor,
  workingDefault,
} from './default-destination';

// Where a person's new documents go, read on the client
// (docs/specs/013-workspace/default-folders.md "Surfaces", "Precedence", "Dangling defaults").

const index = buildDefaultFolderIndex(
  [
    { id: 'workshops', name: 'Workshops', parentId: null },
    { id: 'retros', name: 'Retros', parentId: 'workshops' },
  ],
  { 'team-a': [{ id: 'sprints', name: 'Sprints', parentId: null }] },
  [{ id: 'team-a', name: 'Design team' }],
);

const defaults = (entries: [PlacementDefaultKey, string][]) => new Map(entries);

describe('workingDefault', () => {
  it('answers a personal or listed team folder', () => {
    const d = defaults([
      ['mode:draw', 'workshops'],
      ['mode:diagram', 'sprints'],
    ]);
    expect(workingDefault('mode:draw', d, index)?.name).toBe('Workshops');
    expect(workingDefault('mode:diagram', d, index)?.teamId).toBe('team-a');
  });

  it('answers null for no default or a folder it cannot see', () => {
    expect(workingDefault('mode:draw', defaults([]), index)).toBeNull();
    expect(workingDefault('mode:draw', defaults([['mode:draw', 'gone']]), index)).toBeNull();
  });
});

describe('resolveDefaultFor', () => {
  it('tries kind, then template, then mode', () => {
    const d = defaults([
      ['template:retrospective', 'retros'],
      ['mode:diagram', 'workshops'],
    ]);
    const retro = {
      mode: 'diagram' as const,
      tabKind: 'diagram' as const,
      templateFamily: 'retrospective' as const,
    };
    expect(resolveDefaultFor(retro, d, index)).toMatchObject({
      resolved: { key: 'template:retrospective', folder: { id: 'retros' } },
      skipped: [],
    });
    expect(resolveDefaultFor({ mode: 'diagram', tabKind: 'diagram' }, d, index).resolved?.key).toBe(
      'mode:diagram',
    );
  });

  it('skips a default it cannot see and says so', () => {
    const d = defaults([
      ['kind:event-storming', 'gone'],
      ['mode:diagram', 'workshops'],
    ]);
    expect(
      resolveDefaultFor({ mode: 'diagram', tabKind: 'event-storming' }, d, index),
    ).toMatchObject({
      resolved: { key: 'mode:diagram' },
      skipped: ['kind:event-storming'],
    });
  });

  it('resolves nothing with no defaults', () => {
    expect(resolveDefaultFor({ mode: 'draw', tabKind: 'diagram' }, defaults([]), index)).toEqual({
      resolved: null,
      skipped: [],
    });
  });
});

describe('representativeIntent', () => {
  it('reads kind and template entries in Diagram mode', () => {
    expect(representativeIntent('mode:draw')).toEqual({ mode: 'draw', tabKind: 'diagram' });
    expect(representativeIntent('kind:event-storming')).toEqual({
      mode: 'diagram',
      tabKind: 'event-storming',
    });
    expect(representativeIntent('template:kanban')).toEqual({
      mode: 'diagram',
      tabKind: 'diagram',
      templateFamily: 'kanban',
    });
  });
});

describe('destinationOf', () => {
  it('is the root without a default', () => {
    expect(destinationOf('mode:draw', defaults([]), index)).toEqual({ kind: 'root' });
  });

  it('is the folder, with its team, when it works', () => {
    expect(destinationOf('mode:draw', defaults([['mode:draw', 'sprints']]), index)).toMatchObject({
      kind: 'folder',
      folder: { id: 'sprints' },
      teamName: 'Design team',
    });
  });

  it('is dangling when deleted, naming where those documents go instead', () => {
    const d = defaults([
      ['template:kanban', 'gone'],
      ['mode:diagram', 'workshops'],
    ]);
    expect(
      destinationOf('template:kanban', d, index, () => ({ name: 'Boards', teamId: null })),
    ).toEqual({
      kind: 'dangling',
      folderId: 'gone',
      name: 'Boards',
      reason: 'deleted',
      fallback: expect.objectContaining({ id: 'workshops' }),
    });
    expect(
      destinationOf('mode:diagram', defaults([['mode:diagram', 'gone']]), index),
    ).toMatchObject({
      kind: 'dangling',
      name: null,
      fallback: null,
    });
  });

  it('is unavailable when its team is not among the reader’s', () => {
    const d = defaults([['mode:draw', 'old-team-folder']]);
    expect(
      destinationOf('mode:draw', d, index, () => ({ name: 'Plans', teamId: 'team-left' })),
    ).toMatchObject({ kind: 'dangling', reason: 'unavailable', name: 'Plans' });
  });
});

describe('folderDefaultKeys', () => {
  it('lists the keys a folder holds, in list order', () => {
    const d = defaults([
      ['template:kanban', 'workshops'],
      ['mode:draw', 'workshops'],
      ['mode:diagram', 'retros'],
    ]);
    expect(folderDefaultKeys('workshops', d)).toEqual(['mode:draw', 'template:kanban']);
    expect(folderDefaultKeys('nothing', d)).toEqual([]);
  });
});
