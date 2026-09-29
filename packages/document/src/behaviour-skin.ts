// The Behaviour elements that look like controls or furniture (the mode and
// session buttons, the timer among them, the picker, the reveal cover, the
// chair) used to be CREATED with fixed light colours stamped onto them. A
// stored colour is the author's choice and wins over the surface, so on the
// Default scheme they stayed white-on-dark-canvas in dark mode, forever. They
// now store no colour, like any plain shape, and resolve through the
// default*Color helpers, which give them a control skin per surface
// (colors.ts). This module is the other half: an element saved with one of
// the old stamped skins still carries it, so that exact skin reads as UNSET.
//
// Same idea as isLegacyModeButtonSkin (selection-mode.ts), which it folds in.

import type { BoxedElement, ShapeKind } from './index';
import { isLegacyModeButtonSkin, MODE_BUTTON_SKIN } from './selection-mode';

type Skin = { fill?: string; stroke?: string; text?: string };

// Exactly what createShape used to stamp, per kind. A colour pair that
// differs in any slot is a real choice and is left alone.
const STAMPED_SKINS: Partial<Record<ShapeKind, Skin>> = {
  'mode-button': MODE_BUTTON_SKIN,
  'session-button': MODE_BUTTON_SKIN,
  picker: MODE_BUTTON_SKIN,
  reveal: { stroke: '#94a3b8', text: '#0f172a' },
  chair: { stroke: '#94a3b8', text: '#0f172a' },
};

function wearsStampedSkin(el: BoxedElement): boolean {
  if (el.type !== 'shape') return false;
  if (isLegacyModeButtonSkin(el)) return true;
  const skin = STAMPED_SKINS[el.shape];
  if (!skin) return false;
  return (
    (skin.fill === undefined || el.fillColor === skin.fill) &&
    (skin.stroke === undefined || el.strokeColor === skin.stroke) &&
    (skin.text === undefined || el.textColor === skin.text)
  );
}

// The colours the author actually chose: the stored ones, minus an old
// stamped skin. Callers resolve each missing slot with default*Color, exactly
// as for any element (`ownColours(el).fill ?? defaultFillColor(el, surface)`).
export function ownColours(el: BoxedElement): { fill?: string; stroke?: string; text?: string } {
  const stored = {
    fill: 'fillColor' in el ? el.fillColor : undefined,
    stroke: 'strokeColor' in el ? el.strokeColor : undefined,
    text: 'textColor' in el ? el.textColor : undefined,
  };
  if (!wearsStampedSkin(el)) return stored;
  // Only the slots the stamp wrote are cleared (a reveal's transparent fill
  // was never part of it).
  const skin =
    el.type === 'shape' && isLegacyModeButtonSkin(el)
      ? MODE_BUTTON_SKIN
      : STAMPED_SKINS[(el as { shape: ShapeKind }).shape]!;
  return {
    fill: skin.fill === undefined ? stored.fill : undefined,
    stroke: skin.stroke === undefined ? stored.stroke : undefined,
    text: skin.text === undefined ? stored.text : undefined,
  };
}
