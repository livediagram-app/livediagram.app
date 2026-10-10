import type { PaletteProps } from './palette.types';

// The editor add-handlers a palette surface is wired to: one per kind of
// thing a tile can place or arm. Named once here so the strip
// (docs/specs/007-editor/toolbar-layout.md), its More popover and its Search all take the same set, and
// a handler missing from the list cannot leave a tile that silently does nothing.
export const PALETTE_ADD_HANDLER_KEYS = [
  'onAddShape',
  'onAddIcon',
  'onAddSticker',
  'onAddTechIcon',
  'onInsertLibraryShape',
  'onAddText',
  'onAddSticky',
  'onAddTable',
  'onAddAnnotation',
  'onAddLinkCard',
  'onAddVideo',
  'onAddBanner',
  'onAddHero',
  'onAddHeader',
  'onAddCallout',
  'onAddStatRow',
  'onAddProcess',
  'onAddAvatar',
  'onAddImage',
  'onAddArrow',
  'onBeginFreehand',
  'onBeginHighlighter',
  'onBeginMarker',
  'onBeginShapePen',
  'onBeginPolygon',
  'onBeginPath',
  // Not an add: a tile pressed while armed puts its tool down again.
  'onCancelDraw',
] as const satisfies readonly (keyof PaletteProps)[];

export type PaletteAddHandlers = Pick<PaletteProps, (typeof PALETTE_ADD_HANDLER_KEYS)[number]>;

// Just the add-handlers out of a wider props bag (the canvas chrome's), so a
// surface can be handed them in one spread.
export function pickPaletteAddHandlers(props: PaletteAddHandlers): PaletteAddHandlers {
  const out: Partial<Record<keyof PaletteAddHandlers, unknown>> = {};
  for (const key of PALETTE_ADD_HANDLER_KEYS) out[key] = props[key];
  return out as PaletteAddHandlers;
}
