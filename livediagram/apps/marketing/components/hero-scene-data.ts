// The editor-window scenes (docs/specs/019-marketing/marketing-site.md "Hero" and "Story beats"):
// one live document per mode at work, each in the editor window it is drawn in. The hero's stage
// plays them in turn (HeroIllustration.tsx), and each landing beat and feature category page plays
// the one that shows its feature (FeatureScene.tsx), so a scene is declared once, here.
//
// The data alone, without the boards: a page that shows one scene (FeatureScene) loads only that
// scene's board, never all four. hero-scenes.tsx pairs each with its board for the hero stage.

import type { TabDef } from './hero-editor-window';
import type { HeroMode } from './hero-mode-palette';

export type HeroSceneKey = 'diagram' | 'draw' | 'mindmap' | 'townhall';

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
  // Where its Build yours button goes: the template step narrowed to this kind
  // (docs/specs/007-editor/new-document-route.md "?mode= and ?q=").
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

// In the order the hero's stage plays them.
export const HERO_SCENE_DATA: HeroSceneData[] = [
  {
    key: 'diagram',
    word: 'Diagram',
    build: '/new?mode=diagram',
    short: 'Diagram',
    title: 'Onboarding',
    label: 'Diagram: map a flow together, with arrows that connect and shapes that snap',
    mode: 'diagram',
    tabs: [
      { name: 'Sign-up', color: '#0ea5e9', active: true },
      { name: 'Checkout', color: '#ec4899' },
      { name: 'Billing', color: '#8b5cf6' },
    ],
    shared: true,
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'draw',
    word: 'Whiteboard',
    build: '/new?mode=draw',
    short: 'Draw',
    title: 'Sprint retro',
    label: 'Draw: sketch on a whiteboard together, markers, stickies and all',
    mode: 'draw',
    tabs: [
      { name: 'Went well', color: '#10b981', active: true },
      { name: 'To improve', color: '#f59e0b' },
    ],
    shared: true,
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'mindmap',
    word: 'Brainstorm',
    build: '/new?mode=diagram&q=mind%20map',
    short: 'Mind map',
    title: 'Launch plan',
    label: 'Mind map: grow ideas out from the centre, one Tab at a time',
    mode: 'diagram',
    tabs: [
      { name: 'Ideas', color: '#0ea5e9', active: true },
      { name: 'Actions', color: '#10b981' },
    ],
    shared: true,
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'townhall',
    word: 'Workshop',
    short: 'Town hall',
    build: '/new?mode=workshop&q=town%20hall',
    title: 'Q3 all-hands',
    label: 'Town hall: questions in, votes up, answered live with the whole room',
    mode: 'workshop',
    tabs: [
      { name: 'Q&A', color: '#ef4444', active: true },
      { name: 'Agenda', color: '#0ea5e9' },
    ],
    shared: true,
    landscapeViewBox: '-28 -60 668 400',
    portraitViewBox: PORTRAIT,
  },
];

export function heroSceneData(key: HeroSceneKey): HeroSceneData {
  return HERO_SCENE_DATA.find((scene) => scene.key === key)!;
}
