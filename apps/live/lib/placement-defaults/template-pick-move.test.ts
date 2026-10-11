import { describe, expect, it } from 'vitest';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import { buildDefaultFolderIndex } from './default-destination';
import { templatePickMoveTarget } from './template-pick-move';

// docs/specs/013-workspace/default-folders.md "A template picked after creation"
const index = buildDefaultFolderIndex(
  [
    { id: 'boards', name: 'Boards', parentId: null },
    { id: 'plans', name: 'Plans', parentId: null },
  ],
  {},
  [],
);
const defaults = new Map<PlacementDefaultKey, string>([
  ['template:kanban', 'boards'],
  ['mode:plan', 'plans'],
]);
const kanban = { mode: 'plan', tabKind: 'diagram', templateFamily: 'kanban' } as const;
const handoff = { documentId: 'd', tabId: 't', placementChosen: false };
const at = (over: Partial<Parameters<typeof templatePickMoveTarget>[0]> = {}) =>
  templatePickMoveTarget({
    handoff,
    intent: kanban,
    current: { folderId: 'plans', teamId: null },
    defaults,
    index,
    ...over,
  });

describe('templatePickMoveTarget', () => {
  it("moves a document filed by its mode's default to the template's default", () => {
    expect(at()?.folder.id).toBe('boards');
    expect(at()?.key).toBe('template:kanban');
  });

  it('leaves one already there', () => {
    expect(at({ current: { folderId: 'boards', teamId: null } })).toBeNull();
  });

  it('leaves a folder the person chose, and a document the wizard did not just make', () => {
    expect(at({ handoff: { ...handoff, placementChosen: true } })).toBeNull();
    expect(at({ handoff: null })).toBeNull();
  });

  it('falls back through the precedence: no template default, the mode default', () => {
    const modeOnly = new Map<PlacementDefaultKey, string>([['mode:plan', 'plans']]);
    expect(at({ defaults: modeOnly, current: { folderId: null, teamId: null } })?.folder.id).toBe(
      'plans',
    );
    expect(at({ defaults: new Map() })).toBeNull();
  });
});
