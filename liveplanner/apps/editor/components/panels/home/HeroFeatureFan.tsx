'use client';

// The art on the right of Explorer Home's hero (docs/specs/013-workspace/explorer-home.md "The hero"): one of each
// tab a plan holds, a Board, a Sheet, a Dashboard and a Form, the same for everyone. The shared Explorer
// (@liveworkspace/explorer) draws the hero and takes this as its `heroArt`; ExplorerHost hands it over, laid out by
// the Explorer's own HeroSheets. Static art, drawn from the pictures Start Planning offers (components/plan), so a
// feature looks the same here as where it is made; nothing is fetched. Each picture is drawn in both the light and
// the dark plan palette and the page's own appearance shows one. liveworkspace.app, which carries none of this code,
// draws the same pictures from @liveplanner/templates/hero.json, generated from these (hero-manifest.test.tsx).

import type { ReactNode } from 'react';
import { HeroSheets, type HeroSheet } from '@liveworkspace/explorer';
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

/** Each feature's picture, as Start Planning draws it, in a plan palette. */
export const HERO_PICTURES: Record<HeroFeature['id'], (palette: PlanPalette) => ReactNode> = {
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

/** The sheets, each picture in the light and the dark plan palette. */
export function heroSheets(): HeroSheet[] {
  return HERO_FEATURES.map((feature) => ({
    id: feature.id,
    label: feature.label,
    light: HERO_PICTURES[feature.id](LIGHT),
    dark: HERO_PICTURES[feature.id](DARK),
  }));
}

export function HeroFeatureFan() {
  return <HeroSheets label={HERO_FEATURES_LABEL} sheets={heroSheets()} />;
}

export default HeroFeatureFan;
