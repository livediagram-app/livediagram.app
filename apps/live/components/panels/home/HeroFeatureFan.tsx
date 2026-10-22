'use client';

// The hero's fanned previews (docs/specs/013-workspace/explorer-home.md "The hero"): one of each tab a project holds,
// a Board, a Sheet, a Dashboard and a Form, the same for everyone. Static art, drawn from the pictures Start Planning
// offers (components/plan), so a feature looks the same here as where it is made; nothing is fetched. Each picture is
// drawn in both the light and the dark plan palette and the page's own appearance shows one, so the art never waits
// on a theme read or flashes the wrong one.

import type { ReactNode } from 'react';
import { DASHBOARD_PRESETS, planPalette, type PlanPalette } from '@liveplanner/document';
import { FORM_STARTER_VIEWBOX, FormStarterArt } from '@liveplanner/template-previews';
import { BOARD_PREVIEWS } from '@/components/plan/board-previews';
import { SheetPreview } from '@/components/plan/sheet-previews';
import { DashboardLayoutPicture } from '@/components/plan/DashboardLayoutPicture';
import { HERO_FEATURES, HERO_COPY, type HeroFeature } from '@/app/explorer/home/hero-model';
import { SHEET_FRAME, SHEET_PLACES } from './home-styles';

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

// The pictures size themselves for a Start Planning tile; in a sheet they fill it.
const FILL = 'block h-full w-full [&>*]:h-full! [&>*]:w-full!';

export function HeroFeatureFan() {
  return (
    <div
      role="group"
      aria-label={HERO_COPY.featuresLabel}
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
