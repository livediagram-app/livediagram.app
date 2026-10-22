// The editor-window scenes (docs/specs/019-marketing/marketing-site.md "Hero" and "Story beats"):
// one live project per kind of tab at work, each in the editor window it is drawn in. The hero's stage
// plays them in turn (HeroIllustration.tsx), and each landing beat and feature category page plays
// the one that shows its feature (FeatureScene.tsx), so a scene is declared once, here.
//
// The data alone, without the boards: a page that shows one scene (FeatureScene) loads only that
// scene's board, never all five. hero-scenes.tsx pairs each with its board for the hero stage.

import type { TabDef } from './hero-editor-window';
import type { HeroMode } from './hero-mode-palette';
import type { PlanTab } from './hero-plan-bars';

export type HeroSceneKey = 'plan' | 'sheet' | 'form' | 'dashboard' | 'together';

export type HeroSceneData = {
  key: HeroSceneKey;
  // The project's name in the window's header.
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
  // A Plan scene's tab, whose own bar the window draws where the Palette would be.
  planTab?: PlanTab;
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
    key: 'plan',
    word: 'Plan',
    build: '/new?mode=plan',
    short: 'Plan',
    title: 'Launch',
    label: 'Plan: move cards across a board together, with WIP limits and quick add',
    mode: 'plan',
    planTab: 'board',
    // To do (from x -59) to Done (to x 659) with a margin either side, so a beat's narrower canvas never
    // clips them; Backlog stays just off the left, as on a board scrolled a little right.
    landscapeViewBox: '-74 -60 748 400',
    tabs: [
      { name: 'Board', color: '#8b5cf6', active: true },
      { name: 'Roadmap', color: '#10b981' },
    ],
    shared: true,
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'sheet',
    word: 'Budget',
    build: '/new?mode=plan&q=budget',
    short: 'Sheet',
    title: 'Q3 budget',
    label: 'Sheet: formulas that fill down and charts made from the cells, live for everyone',
    mode: 'plan',
    planTab: 'sheet',
    tabs: [
      { name: 'Budget', color: '#10b981', active: true },
      { name: 'Board', color: '#8b5cf6' },
    ],
    shared: true,
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'form',
    word: 'Collect',
    build: '/new?mode=plan&q=rsvp',
    short: 'Form',
    title: 'Summer party',
    label:
      'Form: share a link, and every answer lands as a row in your sheet or a card on your board',
    mode: 'plan',
    planTab: 'form',
    tabs: [
      { name: 'RSVP', color: '#7c3aed', active: true },
      { name: 'Responses', color: '#10b981' },
    ],
    shared: true,
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'dashboard',
    word: 'Overview',
    build: '/new?mode=plan&q=product%20launch',
    short: 'Dashboard',
    title: 'Product launch',
    label:
      'Dashboard: the board, the budget and the launch date on one page, live for the whole team',
    mode: 'plan',
    planTab: 'dashboard',
    tabs: [
      { name: 'Overview', color: '#8b5cf6', active: true },
      { name: 'Board', color: '#10b981' },
      { name: 'Budget', color: '#f59e0b' },
    ],
    shared: true,
    portraitViewBox: PORTRAIT,
  },
  {
    key: 'together',
    word: 'Together',
    build: '/new?mode=plan&q=kanban',
    short: 'Together',
    title: 'Sprint 12',
    label:
      'Together: three people on one board, a comment thread on a card and a card moving, all live',
    mode: 'plan',
    planTab: 'board',
    tabs: [
      { name: 'Sprint', color: '#8b5cf6', active: true },
      { name: 'Overview', color: '#10b981' },
    ],
    shared: true,
    portraitViewBox: PORTRAIT,
  },
];

export function heroSceneData(key: HeroSceneKey): HeroSceneData {
  return HERO_SCENE_DATA.find((scene) => scene.key === key)!;
}
