import { describe, expect, it } from 'vitest';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import { buildDefaultFolderIndex } from './default-destination';
import { templatePickMoveTarget } from './template-pick-move';

// docs/specs/013-workspace/default-folders.md "A template picked after creation"
const index = buildDefaultFolderIndex(
  [
    { id: 'retros', name: 'Retros', parentId: null },
    { id: 'sessions', name: 'Sessions', parentId: null },
  ],
  {},
  [],
);
const defaults = new Map<PlacementDefaultKey, string>([
  ['template:retrospective', 'retros'],
  ['mode:workshop', 'sessions'],
]);
const retro = { mode: 'workshop', tabKind: 'diagram', templateFamily: 'retrospective' } as const;
const handoff = { documentId: 'd', tabId: 't', placementChosen: false };
const at = (over: Partial<Parameters<typeof templatePickMoveTarget>[0]> = {}) =>
  templatePickMoveTarget({
    handoff,
    intent: retro,
    current: { folderId: 'sessions', teamId: null },
    defaults,
    index,
    ...over,
  });

describe('templatePickMoveTarget', () => {
  it("moves a document filed by its mode's default to the template's default", () => {
    expect(at()?.folder.id).toBe('retros');
    expect(at()?.key).toBe('template:retrospective');
  });

  it('leaves one already there', () => {
    expect(at({ current: { folderId: 'retros', teamId: null } })).toBeNull();
  });

  it('leaves a folder the person chose, and a document the wizard did not just make', () => {
    expect(at({ handoff: { ...handoff, placementChosen: true } })).toBeNull();
    expect(at({ handoff: null })).toBeNull();
  });

  it('falls back through the precedence: no template default, the mode default', () => {
    const modeOnly = new Map<PlacementDefaultKey, string>([['mode:workshop', 'sessions']]);
    expect(at({ defaults: modeOnly, current: { folderId: null, teamId: null } })?.folder.id).toBe(
      'sessions',
    );
    expect(at({ defaults: new Map() })).toBeNull();
  });
});
