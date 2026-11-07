// A Window's drawing (docs/specs/009-elements/room-builder.md "Window"): the parts the canvas (WindowView) and the
// export (svg-render-doors windowSvg) both paint, in the window's own px with the wall's centre line along
// y = height / 2. A frame in the wall's band, a glass pane with a mullion, a sill on the inside face, and the patch of
// light it casts on the floor inside (+y, the side the snap turns inward), drawn past its box. Pure: no React, no DOM.

import { ROOM_WALL } from '@liveworkspace/avatar/office-geometry';

/** The light patch's colour and strongest opacity on each paper (DEFAULTS.md D228): sunlight, and a fainter moonlight. */
export const WINDOW_LIGHT = {
  light: { colour: '#fde68a', opacity: 0.55 },
  dark: { colour: '#bfdbfe', opacity: 0.16 },
} as const;

/** How deep the light falls, and how far it spreads each side, as shares of the window's width (DEFAULTS.md D228). */
export const WINDOW_LIGHT_DEPTH = 0.8;
export const WINDOW_LIGHT_SPREAD = 0.2;

type Box = { x: number; y: number; w: number; h: number };

export type WindowArt = {
  /** The wall's band across the window, in the floor outlined in the stroke. */
  frame: Box;
  /** The pane of glass in it. */
  pane: Box;
  /** The mullion across the pane's middle. */
  mullion: string;
  /** The sill along the inside face. */
  sill: Box;
  /** The patch of light on the floor inside: a trapezoid, closed. */
  light: string;
  /** Where the patch's fade runs from (strongest) and to (nothing), along the window's +y. */
  fade: { from: number; to: number };
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** A window's parts at its size. */
export function windowArt(width: number, height: number): WindowArt {
  const mid = height / 2;
  const half = ROOM_WALL / 2;
  const jamb = Math.min(6, width / 4);
  const sillDepth = 2.5;
  const from = r2(mid + half + sillDepth);
  const to = r2(from + width * WINDOW_LIGHT_DEPTH);
  const spread = width * WINDOW_LIGHT_SPREAD;
  return {
    frame: { x: 0, y: r2(mid - half), w: r2(width), h: ROOM_WALL },
    pane: { x: r2(jamb), y: r2(mid - 2.5), w: r2(Math.max(0, width - 2 * jamb)), h: 5 },
    mullion: `M${r2(width / 2)} ${r2(mid - half)}V${r2(mid + half)}`,
    sill: {
      x: r2(jamb - 2),
      y: r2(mid + half),
      w: r2(Math.max(0, width - 2 * jamb + 4)),
      h: sillDepth,
    },
    light: `M${r2(jamb)} ${from}L${r2(width - jamb)} ${from}L${r2(width - jamb + spread)} ${to}L${r2(jamb - spread)} ${to}Z`,
    fade: { from, to },
  };
}
