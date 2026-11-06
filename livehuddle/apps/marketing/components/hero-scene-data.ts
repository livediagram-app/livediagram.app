// The editor-window scenes (docs/specs/019-marketing/marketing-site.md "Feature scenes"): one Space in use per
// landing beat, each in the editor window it is drawn in. Each landing beat and feature category page plays the one
// that shows its feature (FeatureScene.tsx), so a scene is declared once, here.
//
// The data alone, without the boards: a page that shows one scene (FeatureScene) loads only that scene's board,
// never all three. hero-scenes.tsx pairs each with its board.

import type { TabDef } from './hero-editor-window';
import type { HeroMode } from './hero-mode-palette';
import { TEAM_POD, viewBoxOf } from './hero-space-cast';
import { HALL, OFFICE } from './hero-space-places';

export type HeroSceneKey = 'space' | 'office' | 'hall';

export type HeroSceneData = {
  key: HeroSceneKey;
  // The document's name in the window's header.
  title: string;
  // What the hero's dot navigation says about this window while it is centred.
  label: string;
  // The name its frame carries on the hero's overview (hero-overview.tsx).
  short: string;
  // The hero headline's word while this window is centred (lib/hero-word-pin.ts).
  word: string;
  // Where its Build yours button goes: the template step searched for this kind
  // (docs/specs/007-editor/new-document-route.md "?q=").
  build: string;
  mode: HeroMode;
  tabs: TabDef[];
  shared: boolean;
  // The landscape viewBox, when the scene reaches past the shared 600 by 400 one (LANDSCAPE_VIEWBOX):
  // as tall, so the hero's height-bound canvas draws it at the same scale, only wider.
  landscapeViewBox?: string;
  // The portrait viewBox a phone draws it in: taller than wide.
  portraitViewBox: string;
};

const PORTRAIT = '0 -40 360 520';

// In the order the landing beats play them.
export const HERO_SCENE_DATA: HeroSceneData[] = [
  {
    key: 'space',
    word: 'Space',
    build: '/new?q=team%20pod',
    short: 'Team Pod',
    title: 'Team Pod',
    label: 'Team Pod: walk in as yourself and gather round the table with your team',
    mode: 'workshop',
    tabs: [
      { name: 'Stand-up', color: '#10b981', active: true },
      { name: 'Coffee Corner', color: '#f59e0b' },
      { name: 'Focus Room', color: '#8b5cf6' },
    ],
    shared: true,
    landscapeViewBox: viewBoxOf(TEAM_POD.stage),
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'hall',
    word: 'All-Hands',
    build: '/new?q=all-hands',
    short: 'All-Hands',
    title: 'Friday All-Hands',
    label: 'All-Hands Hall: the room sits facing the stage, and cheers the wins together',
    mode: 'workshop',
    tabs: [
      { name: 'Main Hall', color: '#10b981', active: true },
      { name: 'Breakout', color: '#0ea5e9' },
    ],
    shared: true,
    landscapeViewBox: viewBoxOf(HALL.stage),
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'office',
    word: 'Office',
    build: '/new?q=virtual%20office',
    short: 'Office',
    title: 'Our Office',
    label: 'Virtual Office: the team walks from their desks to the meeting room to talk',
    mode: 'workshop',
    tabs: [
      { name: 'Ground Floor', color: '#10b981', active: true },
      { name: 'Rooftop', color: '#f59e0b' },
    ],
    shared: true,
    landscapeViewBox: viewBoxOf(OFFICE.stage),
    portraitViewBox: PORTRAIT,
  },
];

export function heroSceneData(key: HeroSceneKey): HeroSceneData {
  return HERO_SCENE_DATA.find((scene) => scene.key === key)!;
}
