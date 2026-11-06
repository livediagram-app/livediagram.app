// The editor-window scenes (docs/specs/019-marketing/marketing-site.md "Feature scenes"): one Space in use per
// landing beat, each paired with its board, so a scene is declared once, here (hero-scene-data.ts holds the rest).

import type { ComponentType } from 'react';
import { HERO_SCENE_DATA, type HeroSceneData, type HeroSceneKey } from './hero-scene-data';
import { HallScene, OfficeScene, TeamPodScene } from './hero-space-scene';

export type { HeroSceneKey } from './hero-scene-data';

// The scene's live document, drawn in the window (hero-scene-data.ts holds the rest).
type HeroScene = HeroSceneData & { Board: ComponentType<{ portrait?: boolean }> };

const BOARDS: Record<HeroSceneKey, ComponentType<{ portrait?: boolean }>> = {
  space: TeamPodScene,
  office: OfficeScene,
  hall: HallScene,
};

export const HERO_SCENES: HeroScene[] = HERO_SCENE_DATA.map((scene) => ({
  ...scene,
  Board: BOARDS[scene.key],
}));
