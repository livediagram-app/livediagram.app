// The editor-window scenes (docs/specs/019-marketing/marketing-site.md "Story beats"): one live
// design per kind of page at work, each in the editor window it is drawn in. Each landing beat and
// feature category page plays the one that shows its feature (FeatureScene.tsx), so a scene is
// declared once, here.
//
// The data alone, without the boards: a page that shows one scene (FeatureScene) loads only that
// scene's board, never all of them.

import type { TabDef } from './hero-editor-window';

export type HeroSceneKey = 'slides' | 'logo' | 'together';

export type HeroSceneData = {
  key: HeroSceneKey;
  // The design's name in the window's header.
  title: string;
  tabs: TabDef[];
  shared: boolean;
  // The landscape viewBox, when the scene reaches past the shared 600 by 400 one (LANDSCAPE_VIEWBOX):
  // as tall, so the canvas draws it at the same scale, only wider.
  landscapeViewBox?: string;
};

export const HERO_SCENE_DATA: HeroSceneData[] = [
  {
    key: 'slides',
    title: 'Board update',
    tabs: [{ name: 'Deck', color: '#0284c7', active: true }],
    shared: true,
  },
  {
    key: 'logo',
    title: 'Bloom brand',
    tabs: [
      { name: 'Logo', color: '#0ea5e9', active: true },
      { name: 'App screens', color: '#10b981' },
    ],
    shared: true,
  },
  {
    key: 'together',
    title: 'Spring launch',
    tabs: [
      { name: 'Brief', color: '#d97706', active: true },
      { name: 'Deck', color: '#0284c7' },
    ],
    shared: true,
  },
];

export function heroSceneData(key: HeroSceneKey): HeroSceneData {
  return HERO_SCENE_DATA.find((scene) => scene.key === key)!;
}
