'use client';

// The art on the right of Explorer Home's hero (docs/specs/013-workspace/explorer-home.md "The hero"): one of each
// tab a plan holds, a Board, a Sheet, a Dashboard and a Form, the same for everyone. The shared Explorer
// (@liveworkspace/explorer) draws the hero and takes this as its `heroArt`; ExplorerShell hands it over. Static
// art, drawn from the pictures Start Planning offers (components/plan), so a feature looks the same here as where
// it is made; nothing is fetched. Each picture is drawn in both the light and the dark plan palette and the page's
// own appearance shows one, so the art never waits on a theme read or flashes the wrong one. It fades in only
// where motion is welcome.

import type { ReactNode } from 'react';
import { DASHBOARD_PRESETS, planPalette, type PlanPalette } from '@liveplanner/project';
import { FORM_STARTER_VIEWBOX, FormStarterArt } from '@liveplanner/template-previews';
import { BOARD_PREVIEWS } from '@/components/plan/board-previews';
import { SheetPreview } from '@/components/plan/sheet-previews';
import { DashboardLayoutPicture } from '@/components/plan/DashboardLayoutPicture';

export type HeroFeature = { id: 'board' | 'sheet' | 'dashboard' | 'form'; label: string };

export const HERO_FEATURES: readonly HeroFeature[] = [
  { id: 'board', label: 'Board' },
  { id: 'sheet', label: 'Sheet' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'form', label: 'Form' },
];

export const HERO_FEATURES_LABEL = 'What a plan can hold';

const LIGHT = planPalette('light');
const DARK = planPalette('dark');

const OVERVIEW = DASHBOARD_PRESETS.find((p) => p.id === 'overview')!;
const Kanban = BOARD_PREVIEWS.kanban!;

/** Each feature's picture, as Start Planning draws it. */
const PICTURES: Record<HeroFeature['id'], (palette: PlanPalette) => ReactNode> = {
  board: (palette) => <Kanban palette={palette} />,
  sheet: (palette) => (
    <SheetPreview palette={palette} tile={{ start: 'budget', name: 'Budget', line: '' }} />
  ),
  dashboard: (palette) => <DashboardLayoutPicture rows={OVERVIEW.rows} palette={palette} />,
  // The art without Start Planning's "responses become cards" badge: here the picture is only the Form.
  form: (palette) => (
    <svg viewBox={FORM_STARTER_VIEWBOX} aria-hidden>
      <FormStarterArt starter="feedback" palette={palette} badge={false} />
    </svg>
  ),
};

// One sheet: a white-edged card.
const SHEET_FRAME =
  'absolute overflow-hidden rounded-2xl border-[6px] border-white bg-white dark:border-slate-800 dark:bg-slate-800';

/** The four places, in HERO_FEATURES' order: two behind, turned out to either side, then two in front. */
const SHEET_PLACES = [
  'left-[2%] top-14 h-32 w-[54%] -rotate-[7deg] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.35)]',
  'right-[2%] top-12 h-32 w-[54%] rotate-[6deg] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.35)]',
  'left-[8%] top-[9.75rem] z-10 h-32 w-[50%] -rotate-[2deg] shadow-[0_24px_50px_-18px_color-mix(in_oklab,var(--color-brand-600)_50%,transparent)]',
  'right-[4%] top-[9rem] z-20 h-32 w-[46%] rotate-[3deg] shadow-[0_24px_50px_-18px_color-mix(in_oklab,var(--color-brand-600)_50%,transparent)]',
] as const;

// The pictures size themselves for a Start Planning tile; in a sheet they fill it.
const FILL = 'block h-full w-full [&>*]:h-full! [&>*]:w-full!';

export function HeroFeatureFan() {
  return (
    <div
      role="group"
      aria-label={HERO_FEATURES_LABEL}
      data-hero-features=""
      className="absolute inset-0 motion-safe:animate-fade-in"
    >
      {HERO_FEATURES.map((feature, i) => (
        <span
          key={feature.id}
          role="img"
          aria-label={feature.label}
          data-hero-sheet={feature.id}
          className={`${SHEET_FRAME} ${SHEET_PLACES[i]}`}
        >
          <span className={`${FILL} dark:hidden`}>{PICTURES[feature.id](LIGHT)}</span>
          <span className={`${FILL} hidden dark:block`}>{PICTURES[feature.id](DARK)}</span>
          <span
            aria-hidden
            className="absolute left-1.5 top-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold leading-4 text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200"
          >
            {feature.label}
          </span>
        </span>
      ))}
    </div>
  );
}

export default HeroFeatureFan;
