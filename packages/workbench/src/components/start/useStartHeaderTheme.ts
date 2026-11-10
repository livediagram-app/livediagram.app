// What a start panel's header wears (each product's start spec, "The header band"): its app's Explorer hero backdrop
// (APP_BACKDROP), the band's colours from the panel's palette, and the hero's heading face at the header's size.
// Each product's StartPanel names its app; nothing else differs between them.
import { useMemo } from 'react';
import type { App } from '@liveworkspace/index-client';
import {
  APP_BACKDROP,
  startHeadingFace,
  type HeroBackdropKind,
} from '@liveworkspace/explorer/hero-theme';
import { startBandColours, type StartBandColours, type StartBandInk } from './start-band-colours';

export type StartHeaderTheme = {
  kind: HeroBackdropKind;
  band: StartBandColours;
  /** The title's face: weight, tracking and, for the Typesetter, the serif. */
  face: string;
};

export function startHeaderTheme(app: App, palette: StartBandInk): StartHeaderTheme {
  const kind = APP_BACKDROP[app];
  return { kind, band: startBandColours(palette), face: startHeadingFace(kind) };
}

/** The header's theme, worked out again only when the palette changes (a theme or light and dark switched). */
export function useStartHeaderTheme(app: App, palette: StartBandInk): StartHeaderTheme {
  const { card, text, muted, focus } = palette;
  return useMemo(
    () => startHeaderTheme(app, { card, text, muted, focus }),
    [app, card, text, muted, focus],
  );
}
