'use client';

// Each Watch It Built lesson's icon, on its plate in Get Started (docs/specs/007-editor/watch-it-built.md "The start
// panel"), as each tool has its own in Tools. A lesson with none here shows no plate.
import type { ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideEraser,
  lucideEye,
  lucideLayoutGrid,
  lucidePaintbrush,
  lucidePalette,
  lucidePenTool,
  lucidePencil,
  lucidePresentation,
  lucideSearch,
  lucideShapes,
  lucideStickyNote,
  lucideUsers,
  lucideWandSparkles,
} from '@liveworkspace/icons/lucide';

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => {
  const Icon = lucideGlyph(icon, 18);
  return <Icon />;
};

export const TOPIC_ICONS: Readonly<Record<string, ReactNode>> = {
  'diagram-basics': glyph(lucideShapes),
  'diagram-look': glyph(lucidePalette),
  'diagram-shape': glyph(lucidePaintbrush),
  'diagram-find': glyph(lucideSearch),
  'diagram-tidy': glyph(lucideLayoutGrid),
  'draw-sketch': glyph(lucidePencil),
  'draw-recognition': glyph(lucideWandSparkles),
  'draw-pens': glyph(lucidePenTool),
  'draw-shapes': glyph(lucideShapes),
  'draw-board': glyph(lucideEraser),
  'workshop-ask': glyph(lucideUsers),
  'workshop-stickies': glyph(lucideStickyNote),
  'workshop-reveal': glyph(lucideEye),
  'workshop-run': glyph(lucidePresentation),
};
