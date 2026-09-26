import type { CommandPaletteProps } from './CommandPalette.types';

// The editor add-handlers a palette surface is wired to: one per kind of
// thing a tile can place or arm. Named once here because two surfaces take
// the same set (the floating Palette and the Toolbar layout's strip,
// docs/specs/007-editor/toolbar-layout.md), and a handler added to one list but not the other would leave a
// tile that silently does nothing in one layout.
export const PALETTE_ADD_HANDLER_KEYS = [
  'onAddShape',
  'onAddIcon',
  'onAddSticker',
  'onAddTechIcon',
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
  'onBeginShapePen',
  'onBeginPolygon',
] as const satisfies readonly (keyof CommandPaletteProps)[];

export type PaletteAddHandlers = Pick<
  CommandPaletteProps,
  (typeof PALETTE_ADD_HANDLER_KEYS)[number]
>;

// Just the add-handlers out of a wider props bag (the canvas chrome's), so a
// surface can be handed them in one spread.
export function pickPaletteAddHandlers(props: PaletteAddHandlers): PaletteAddHandlers {
  const out: Partial<Record<keyof PaletteAddHandlers, unknown>> = {};
  for (const key of PALETTE_ADD_HANDLER_KEYS) out[key] = props[key];
  return out as PaletteAddHandlers;
}
