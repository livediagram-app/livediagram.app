// The editor-window scenes (docs/specs/019-marketing/marketing-site.md "Hero" and "Story beats"):
// one live document per mode at work, each in the editor window it is drawn in. The hero's stage
// plays them in turn (HeroIllustration.tsx), and each landing beat and feature category page plays
// the one that shows its feature (FeatureScene.tsx), so a scene is declared once, here.

import type { ComponentType } from 'react';
import { DrawBoard } from './hero-draw-board';
import { HERO_SCENE_DATA, type HeroSceneData, type HeroSceneKey } from './hero-scene-data';
import { SpaceScene } from './hero-space-scene';
import { TownHallBoard } from './hero-townhall-board';

export type { HeroSceneKey } from './hero-scene-data';

// The scene's live document, drawn in the window (hero-scene-data.ts holds the rest).
type HeroScene = HeroSceneData & { Board: ComponentType<{ portrait?: boolean }> };

const BOARDS: Record<HeroSceneKey, ComponentType<{ portrait?: boolean }>> = {
  space: SpaceScene,
  draw: DrawBoard,
  townhall: TownHallBoard,
};

export const HERO_SCENES: HeroScene[] = HERO_SCENE_DATA.map((scene) => ({
  ...scene,
  Board: BOARDS[scene.key],
}));
