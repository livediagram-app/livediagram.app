import { describe, expect, it } from 'vitest';
import { parsePlacement, type PickerFolder } from './PlacementBrowser';
import { placementViewFor as viewFor, type PlacementSpaces } from './placement-view';

const placementViewFor = (placement: string, s: PlacementSpaces) =>
  viewFor(parsePlacement(placement), s);

// Where the placement browser opens for a selection (docs/specs/006-document/save-locations.md,
// "It opens where its selection is"): at the level that lists the selected folder.

const FOLDERS: PickerFolder[] = [
  { id: 'projects', name: 'Projects', parentId: null },
  { id: 'workshops', name: 'Workshops', parentId: 'projects' },
  { id: 'archive', name: 'Archive', parentId: 'workshops' },
  { id: 'loose', name: 'Loose', parentId: null },
];
const TEAM_FOLDERS: PickerFolder[] = [
  { id: 'design', name: 'Design', parentId: null },
  { id: 'sprints', name: 'Sprints', parentId: 'design' },
];

const spaces = (over: Partial<PlacementSpaces> = {}): PlacementSpaces => ({
  showPersonal: true,
  teams: [{ id: 't1', name: 'Team One' }],
  folders: FOLDERS,
  teamFolders: { t1: TEAM_FOLDERS },
  ...over,
});
const ids = (stack: PickerFolder[]) => stack.map((f) => f.id);

describe('placementViewFor', () => {
  it('opens the overview for the My documents root', () => {
    expect(placementViewFor('unsorted', spaces())).toEqual({ space: null, stack: [] });
  });

  it('opens the overview for a team root', () => {
    expect(placementViewFor('team:t1', spaces())).toEqual({ space: null, stack: [] });
  });

  it('opens My documents at its root for a top-level folder', () => {
    const view = placementViewFor('folder:loose', spaces());
    expect(view.space).toBe('personal-space');
    expect(ids(view.stack)).toEqual([]);
  });

  it('opens the parent level for a nested folder', () => {
    const view = placementViewFor('folder:workshops', spaces());
    expect(view.space).toBe('personal-space');
    expect(ids(view.stack)).toEqual(['projects']);
  });

  it('opens the level that lists a folder holding subfolders, not inside it', () => {
    expect(ids(placementViewFor('folder:workshops', spaces()).stack)).toEqual(['projects']);
    expect(ids(placementViewFor('folder:archive', spaces()).stack)).toEqual([
      'projects',
      'workshops',
    ]);
  });

  it('opens a team at the level that lists its folder', () => {
    const view = placementViewFor('team:t1:folder:sprints', spaces());
    expect(view.space).toBe('t1');
    expect(ids(view.stack)).toEqual(['design']);
  });

  it('opens the overview while the folder is not in the lists yet', () => {
    expect(placementViewFor('folder:workshops', spaces({ folders: [] }))).toEqual({
      space: null,
      stack: [],
    });
    expect(placementViewFor('team:t1:folder:sprints', spaces({ teamFolders: {} }))).toEqual({
      space: null,
      stack: [],
    });
  });

  it('ignores a team the surface does not offer', () => {
    expect(placementViewFor('team:gone:folder:sprints', spaces())).toEqual({
      space: null,
      stack: [],
    });
  });

  it('opens the one team of a team-scoped surface at its root', () => {
    const scoped = spaces({ showPersonal: false });
    expect(placementViewFor('team:t1', scoped)).toEqual({ space: 't1', stack: [] });
    expect(ids(placementViewFor('team:t1:folder:sprints', scoped).stack)).toEqual(['design']);
  });

  it('never opens My documents on a surface that does not offer it', () => {
    expect(placementViewFor('folder:workshops', spaces({ showPersonal: false }))).toEqual({
      space: 't1',
      stack: [],
    });
  });
});
