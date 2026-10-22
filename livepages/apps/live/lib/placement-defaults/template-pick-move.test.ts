import { describe, expect, it } from 'vitest';
import type { PlacementDefaultKey } from '@livepages/api-schema';
import { buildDefaultFolderIndex } from './default-destination';
import { templatePickMoveTarget } from './template-pick-move';

// docs/specs/013-workspace/default-folders.md "A template picked after creation"
const index = buildDefaultFolderIndex(
  [
    { id: 'decks', name: 'Decks', parentId: null },
    { id: 'other', name: 'Other', parentId: null },
  ],
  {},
  [],
);
const defaults = new Map<PlacementDefaultKey, string>([['mode:pages', 'decks']]);
const deck = { mode: 'pages', tabKind: 'diagram' } as const;
const handoff = { documentId: 'd', tabId: 't', placementChosen: false };
const at = (over: Partial<Parameters<typeof templatePickMoveTarget>[0]> = {}) =>
  templatePickMoveTarget({
    handoff,
    intent: deck,
    current: { folderId: 'other', teamId: null },
    defaults,
    index,
    ...over,
  });

describe('templatePickMoveTarget', () => {
  it("moves a document to its mode's default", () => {
    expect(at()?.folder.id).toBe('decks');
    expect(at()?.key).toBe('mode:pages');
  });

  it('leaves one already there', () => {
    expect(at({ current: { folderId: 'decks', teamId: null } })).toBeNull();
  });

  it('leaves a folder the person chose, and a document the wizard did not just make', () => {
    expect(at({ handoff: { ...handoff, placementChosen: true } })).toBeNull();
    expect(at({ handoff: null })).toBeNull();
  });

  it('leaves it with no default', () => {
    expect(at({ defaults: new Map() })).toBeNull();
  });
});
