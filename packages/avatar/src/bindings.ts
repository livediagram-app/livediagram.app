// The product facts Avatar mode reads at run time (livediagram's docs/specs/008-canvas/avatar-mode.md "Where the
// code lives"). Each editor tells the package once, at startup, the way it binds the workbench: its
// lib/avatar-bindings.ts calls configureAvatar from the root providers, before any component renders. Avatar code
// reads them through `avatarBindings`, and only when it runs, never at module scope. Until then every binding has a
// safe default.

import type { CSSProperties } from 'react';

/**
 * The telemetry events Avatar mode sends: a subset of every product's vocabulary, so each product's own wider
 * `track` binds as it is, and typecheck fails if a vocabulary drops one.
 */
export type AvatarTelemetryCategory = 'Canvas' | 'UI';
export type AvatarTelemetryAction = 'Used' | 'Changed';
export type AvatarTrack = (
  category: AvatarTelemetryCategory,
  action: AvatarTelemetryAction,
  type?: string,
) => void;

export type AvatarBindings = {
  /** The product's telemetry `track` (docs/specs/017-telemetry/telemetry.md), for the events above. */
  track: AvatarTrack;
  /** The localStorage prefix the costume is kept under (`<product>:v2:`), so `<prefix>avatar-config`. */
  storagePrefix: string;
  /** Darken a #rrggbb colour by `amount` (0 to 1): the product's colour maths, for the shirt's shaded side. */
  shade: (hex: string, amount: number) => string;
  /** Lighten a #rrggbb colour toward white by `amount` (0 to 1), for the Avatar Pad's arrival beam. */
  tint: (hex: string, amount: number) => string;
  /** A participant colour's fill under white text in both themes (the product's identity fill). */
  identityVars: (color: string) => CSSProperties;
};

/** What Avatar code reads until an editor configures it: safe no-ops and an `avatar:` prefix. */
export const AVATAR_DEFAULTS: Readonly<AvatarBindings> = Object.freeze({
  track: () => {},
  storagePrefix: 'avatar:v2:',
  shade: (hex: string) => hex,
  tint: (hex: string) => hex,
  identityVars: (color: string) =>
    ({ '--identity': color, '--identity-deep': color }) as CSSProperties,
});

let bound: Readonly<AvatarBindings> = AVATAR_DEFAULTS;

/** Hands the package this editor's facts. Called once at startup; a later call replaces them. */
export function configureAvatar(bindings: AvatarBindings): void {
  bound = bindings;
}

/** The bound facts, each read when used. */
export const avatarBindings = {
  track: ((category, action, type) => bound.track(category, action, type)) satisfies AvatarTrack,
  get storagePrefix(): string {
    return bound.storagePrefix;
  },
  shade: (hex: string, amount: number): string => bound.shade(hex, amount),
  tint: (hex: string, amount: number): string => bound.tint(hex, amount),
  identityVars: (color: string): CSSProperties => bound.identityVars(color),
};
