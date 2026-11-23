'use client';

// Take Snapshot and Revert to Snapshot as a kit's Add an Action tiles (liveworkspace automations.md "Revert to
// Snapshot"; liveplanner automations.md "Snapshot steps"), for an app whose kinds are its own (liveplanner's): the
// same names, lines, icons, pictures, first forms and panels the item kits build (kit-kinds.tsx), in the Snapshots
// group's tone. Both at the rule's top level; a revert ends the rule. The panels read `outline.snapshots`.
import { snapshotActions, type ItemWord } from '@liveworkspace/automations/item';
import type { ComponentType } from 'react';
import type { ActionKind, ActionPanelProps, KindGroup } from '../kit';
import { TONES, TileStage } from '../tile-picker/tile-scene';
import { ITEM_ACTION_GLYPHS } from './glyphs';
import { RevertSnapshotPanel, TakeSnapshotPanel } from './panels/snapshot-panels';
import { ACTION_SCENES } from './scenes/action-scenes';
import { ACTION_GROUP_TONES } from './scenes/tones';
import type { ItemSnapshots } from './types';
import { sharedActionLines } from './words';

export const SNAPSHOT_GROUP_ID = 'snapshots';

type AnyPanel = ComponentType<ActionPanelProps<unknown, unknown>>;
const PANELS: Readonly<Record<string, AnyPanel>> = {
  take_snapshot: TakeSnapshotPanel as unknown as AnyPanel,
  revert_snapshot: RevertSnapshotPanel as unknown as AnyPanel,
};

/** The two tiles, by kind, for a kit whose outline carries the item's snapshots. */
export function snapshotKitActions<Step, Outline extends { snapshots: ItemSnapshots }>(
  itemWord: ItemWord,
): Record<'take_snapshot' | 'revert_snapshot', ActionKind<Step, Outline>> {
  const tone = TONES[ACTION_GROUP_TONES[SNAPSHOT_GROUP_ID]!];
  const lines = sharedActionLines(itemWord);
  const out = {} as Record<'take_snapshot' | 'revert_snapshot', ActionKind<Step, Outline>>;
  for (const def of snapshotActions()) {
    const kind = def.kind as 'take_snapshot' | 'revert_snapshot';
    const Scene = ACTION_SCENES[kind]!;
    out[kind] = {
      name: def.name,
      line: lines[kind]!,
      glyph: ITEM_ACTION_GLYPHS[kind]!,
      scene: () => <TileStage tone={tone}>{Scene({ tone })}</TileStage>,
      fresh: () => def.defaults() as Step,
      Panel: PANELS[kind] as unknown as ComponentType<ActionPanelProps<Step, Outline>>,
      top: true,
      ...(def.last ? { last: true } : {}),
    };
  }
  return out;
}

/** The Snapshots group, for an app whose groups are its own. */
export const snapshotGroup = (): KindGroup => ({
  id: SNAPSHOT_GROUP_ID,
  name: 'Snapshots',
  kinds: snapshotActions().map((d) => d.kind),
});
