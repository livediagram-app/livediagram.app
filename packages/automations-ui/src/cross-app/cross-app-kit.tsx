'use client';

// The steps in other apps as a kit's Add an Action tiles (blueprint cross-app.md "In the builder"): each kind's name,
// line and first form from the registry (@liveworkspace/automations/cross-app), its icon, its picture and its panel
// from here. The item kits (item/kit-kinds.tsx) and liveplanner's take the same five, so every app's builder offers
// them alike. Each is the rule's top level's alone.
import type { ComponentType } from 'react';
import { crossAppActions, type CrossAppKind } from '@liveworkspace/automations/cross-app';
import type { ActionKind, ActionPanelProps } from '../kit';
import { TONES, TileStage, type SceneTone } from '../tile-picker/tile-scene';
import { tileLine } from '../item/words';
import { CROSS_APP_GLYPHS, CROSS_APP_SCENES } from './cross-app-art';
import {
  DocTabPanel,
  InboxNoticePanel,
  KbPagePanel,
  PlanCardPanel,
  SpacePostPanel,
} from './cross-app-panels';

// The group's colour on every app's picker.
export const CROSS_APP_TONE: SceneTone = 'blue';

// Each panel takes its own step; a kit's steps are its own union, so the panel is handed in loose.
type AnyPanel = ComponentType<ActionPanelProps<unknown, unknown>>;
const PANELS: Readonly<Record<CrossAppKind, AnyPanel>> = {
  plan_card: PlanCardPanel as AnyPanel,
  kb_page: KbPagePanel as AnyPanel,
  space_post: SpacePostPanel as AnyPanel,
  doc_tab: DocTabPanel as AnyPanel,
  inbox_notice: InboxNoticePanel as AnyPanel,
};

/** The five tiles, by kind, for a kit of any step and outline. */
export function crossAppKitActions<Step, Outline>(): Record<
  CrossAppKind,
  ActionKind<Step, Outline>
> {
  const tone = TONES[CROSS_APP_TONE];
  const out = {} as Record<CrossAppKind, ActionKind<Step, Outline>>;
  for (const def of crossAppActions()) {
    const kind = def.kind as CrossAppKind;
    const Scene = CROSS_APP_SCENES[kind];
    out[kind] = {
      name: def.name,
      line: tileLine(def.line),
      glyph: CROSS_APP_GLYPHS[kind],
      scene: () => <TileStage tone={tone}>{Scene({ tone })}</TileStage>,
      fresh: () => def.defaults() as Step,
      Panel: PANELS[kind] as unknown as ComponentType<ActionPanelProps<Step, Outline>>,
      top: true,
    };
  }
  return out;
}
