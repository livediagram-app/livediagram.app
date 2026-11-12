'use client';

// One-click style presets for the selected-element context menu (docs/specs/010-palette/style-presets.md):
// the shape, arrow, code-scheme, table and chart-palette grids. The grids are the shared ones
// (@liveworkspace/workbench/components/palette/StylePresets); this binds them once to this editor's
// palette tile and shape silhouette, over its own shape kinds.
import type { ShapeKind } from '@livediagram/document';
import { createStylePresets } from '@liveworkspace/workbench/components/palette/StylePresets';
import { SizeButton } from '@/components/palette/palette-controls';
import { ShapeGlyph } from '@/components/primitives/shape-icon';

export type { ArrowPreset } from '@liveworkspace/workbench/components/palette/StylePresets';

export const { ShapePresets, ArrowPresets, CodeThemePresets, TablePresets, ChartPalettePresets } =
  createStylePresets<ShapeKind>({ SizeButton, ShapeGlyph });
