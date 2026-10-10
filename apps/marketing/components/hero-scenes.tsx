// The editor-window scenes (docs/specs/019-marketing/marketing-site.md "Hero" and "Story beats"):
// one live document per mode at work, each in the editor window it is drawn in. The hero's stage
// plays them in turn (HeroIllustration.tsx), and each landing beat and feature category page plays
// the one that shows its feature (FeatureScene.tsx), so a scene is declared once, here.

import type { ComponentType } from 'react';
import { ArticlePage } from './hero-article-page';
import { DiagramBoard } from './hero-diagram-board';
import { DrawBoard } from './hero-draw-board';
import type { TabDef } from './hero-editor-window';
import { InfographicPages } from './hero-illustrate-page';
import { MindMapBoard } from './hero-mindmap-board';
import type { HeroMode } from './hero-mode-palette';
import { PlanBoard } from './hero-plan-board';
import { TownHallBoard } from './hero-townhall-board';

export type HeroSceneKey =
  'diagram' | 'draw' | 'mindmap' | 'infographic' | 'article' | 'plan' | 'townhall';

export type HeroScene = {
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
  // The scene itself, drawn in its landscape or (on a phone) portrait layout.
  Board: ComponentType<{ portrait?: boolean }>;
  // The portrait viewBox a phone draws it in: taller than wide, the pages' scenes taller still so
  // two pages stack.
  portraitViewBox: string;
};

const PORTRAIT = '0 -40 360 520';
const PORTRAIT_PAGES = '10 -40 360 680';

// In the order the hero's stage plays them.
export const HERO_SCENES: HeroScene[] = [
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
    Board: DiagramBoard,
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
    Board: DrawBoard,
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
    Board: MindMapBoard,
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'infographic',
    word: 'Illustrate',
    build: '/new?mode=illustrate',
    short: 'Infographic',
    title: 'Year in review',
    label: 'Infographic: lay out pages of numbers, charts and quotes, ready to print or share',
    mode: 'illustrate',
    tabs: [{ name: 'Infographic', color: '#8b5cf6', active: true }],
    shared: true,
    Board: InfographicPages,
    portraitViewBox: PORTRAIT_PAGES,
  },
  {
    key: 'article',
    word: 'Document',
    build: '/new?mode=illustrate&q=article',
    short: 'Article',
    title: 'Field notes',
    label: 'Article: write long reads on pages, with images, headings and pull quotes',
    mode: 'illustrate',
    tabs: [{ name: 'Draft', color: '#0ea5e9', active: true }],
    shared: true,
    Board: ArticlePage,
    portraitViewBox: PORTRAIT_PAGES,
  },
  {
    key: 'plan',
    word: 'Plan',
    build: '/new?mode=plan',
    short: 'Plan',
    title: 'Launch',
    label: 'Plan: move cards across a board together, with WIP limits and quick add',
    mode: 'plan',
    tabs: [
      { name: 'Board', color: '#0ea5e9', active: true },
      { name: 'Roadmap', color: '#10b981' },
    ],
    shared: true,
    Board: PlanBoard,
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'townhall',
    word: 'Workshop',
    short: 'Town hall',
    build: '/new?mode=diagram&q=town%20hall',
    title: 'Q3 all-hands',
    label: 'Town hall: questions in, votes up, answered live with the whole room',
    mode: 'diagram',
    tabs: [
      { name: 'Q&A', color: '#ef4444', active: true },
      { name: 'Agenda', color: '#0ea5e9' },
    ],
    shared: true,
    Board: TownHallBoard,
    portraitViewBox: PORTRAIT,
  },
];

export function heroScene(key: HeroSceneKey): HeroScene {
  return HERO_SCENES.find((scene) => scene.key === key)!;
}
