import { describe, expect, it } from 'vitest';
import type { PlacementDefaultKey } from '@liveplanner/api-schema';
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
      ['template:retrospective', 'workshops'],
      ['mode:plan', 'sprints'],
    ]);
    expect(workingDefault('template:retrospective', d, index)?.name).toBe('Workshops');
    expect(workingDefault('mode:plan', d, index)?.teamId).toBe('team-a');
  });

  it('answers null for no default or a folder it cannot see', () => {
    expect(workingDefault('template:retrospective', defaults([]), index)).toBeNull();
    expect(
      workingDefault(
        'template:retrospective',
        defaults([['template:retrospective', 'gone']]),
        index,
      ),
    ).toBeNull();
  });
});

describe('resolveDefaultFor', () => {
  it('tries kind, then template, then mode', () => {
    const d = defaults([
      ['template:retrospective', 'retros'],
      ['mode:plan', 'workshops'],
    ]);
    const retro = {
      mode: 'plan' as const,
      tabKind: 'diagram' as const,
      templateFamily: 'retrospective' as const,
    };
    expect(resolveDefaultFor(retro, d, index)).toMatchObject({
      resolved: { key: 'template:retrospective', folder: { id: 'retros' } },
      skipped: [],
    });
    expect(resolveDefaultFor({ mode: 'plan', tabKind: 'diagram' }, d, index).resolved?.key).toBe(
      'mode:plan',
    );
  });

  it('skips a default it cannot see and says so', () => {
    const d = defaults([
      ['template:kanban', 'gone'],
      ['mode:plan', 'workshops'],
    ]);
    expect(
      resolveDefaultFor({ mode: 'plan', tabKind: 'diagram', templateFamily: 'kanban' }, d, index),
    ).toMatchObject({
      resolved: { key: 'mode:plan' },
      skipped: ['template:kanban'],
    });
  });

  it('resolves nothing with no defaults', () => {
    expect(resolveDefaultFor({ mode: 'plan', tabKind: 'diagram' }, defaults([]), index)).toEqual({
      resolved: null,
      skipped: [],
    });
  });
});

describe('representativeIntent', () => {
  it('reads every entry in Plan', () => {
    expect(representativeIntent('mode:plan')).toEqual({ mode: 'plan', tabKind: 'diagram' });
    expect(representativeIntent('template:kanban')).toEqual({
      mode: 'plan',
      tabKind: 'diagram',
      templateFamily: 'kanban',
    });
  });
});

describe('destinationOf', () => {
  it('is the root without a default', () => {
    expect(destinationOf('template:retrospective', defaults([]), index)).toEqual({ kind: 'root' });
  });

  it('is the folder, with its team, when it works', () => {
    expect(
      destinationOf(
        'template:retrospective',
        defaults([['template:retrospective', 'sprints']]),
        index,
      ),
    ).toMatchObject({
      kind: 'folder',
      folder: { id: 'sprints' },
      teamName: 'Design team',
    });
  });

  it('is dangling when deleted, naming where those documents go instead', () => {
    const d = defaults([
      ['template:kanban', 'gone'],
      ['mode:plan', 'workshops'],
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
    expect(destinationOf('mode:plan', defaults([['mode:plan', 'gone']]), index)).toMatchObject({
      kind: 'dangling',
      name: null,
      fallback: null,
    });
  });

  it('is unavailable when its team is not among the reader’s', () => {
    const d = defaults([['template:retrospective', 'old-team-folder']]);
    expect(
      destinationOf('template:retrospective', d, index, () => ({
        name: 'Plans',
        teamId: 'team-left',
      })),
    ).toMatchObject({ kind: 'dangling', reason: 'unavailable', name: 'Plans' });
  });
});

describe('folderDefaultKeys', () => {
  it('lists the keys a folder holds, in list order', () => {
    const d = defaults([
      ['template:kanban', 'workshops'],
      ['template:retrospective', 'workshops'],
      ['mode:plan', 'retros'],
    ]);
    expect(folderDefaultKeys('workshops', d)).toEqual([
      'template:retrospective',
      'template:kanban',
    ]);
    expect(folderDefaultKeys('nothing', d)).toEqual([]);
  });
});
