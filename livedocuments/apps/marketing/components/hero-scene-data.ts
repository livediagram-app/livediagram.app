// The editor-window scenes (docs/specs/019-marketing/marketing-site.md "Story beats"): one live
// document per kind of page at work, each in the editor window it is drawn in. Each landing beat and
// feature category page plays the one that shows its feature (FeatureScene.tsx), so a scene is
// declared once, here.
//
// The data alone, without the boards: a page that shows one scene (FeatureScene) loads only that
// scene's board, never all of them.

import type { TabDef } from './hero-editor-window';

export type HeroSceneKey = 'article' | 'slides' | 'infographic' | 'together';

export type HeroSceneData = {
  key: HeroSceneKey;
  // The document's name in the window's header.
  title: string;
  tabs: TabDef[];
  shared: boolean;
  // The landscape viewBox, when the scene reaches past the shared 600 by 400 one (LANDSCAPE_VIEWBOX):
  // as tall, so the canvas draws it at the same scale, only wider.
  landscapeViewBox?: string;
};

export const HERO_SCENE_DATA: HeroSceneData[] = [
  {
    key: 'article',
    title: 'Field notes',
    tabs: [{ name: 'Draft', color: '#0ea5e9', active: true }],
    shared: true,
  },
  {
    key: 'slides',
    title: 'Board update',
    tabs: [{ name: 'Deck', color: '#0284c7', active: true }],
    shared: true,
  },
  {
    key: 'infographic',
    title: 'Year in review',
    tabs: [{ name: 'Infographic', color: '#8b5cf6', active: true }],
    shared: true,
    landscapeViewBox: '-24 -60 690 400',
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
