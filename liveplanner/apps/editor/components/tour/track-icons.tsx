'use client';

// Each tour track's icon, on its plate in Get Started (docs/specs/026-plan/plan-tour.md "Starting a tour"), as
// livediagram's lessons and each tool in Tools have theirs.
import type { ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideLayoutGrid,
  lucideSlidersHorizontal,
  lucideSquareKanban,
  lucideTable,
  lucideTag,
} from '@liveworkspace/icons/lucide';

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => {
  const Icon = lucideGlyph(icon, 18);
  return <Icon />;
};

export const TRACK_ICONS: Readonly<Record<string, ReactNode>> = {
  boards: glyph(lucideSquareKanban),
  'card-types': glyph(lucideTag),
  'board-setup': glyph(lucideSlidersHorizontal),
  sheets: glyph(lucideTable),
  dashboards: glyph(lucideLayoutGrid),
};
