'use client';

import { createUsePaletteChrome } from '@liveworkspace/workbench/components/canvas/usePaletteChrome';
import { getTheme } from '@/lib/themes';

// The palette's chrome behaviour (docs/specs/008-canvas/canvas-and-palette.md), shared by the editors and bound to
// this one's themes: the active-tab theme tint the tiles preview.
export const usePaletteChrome = createUsePaletteChrome(getTheme);
