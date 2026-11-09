// Text effects (docs/specs/008-canvas/text-effects.md): the gradient presets a run may be filled with,
// the guards every renderer reads a run's `highlight` and `gradient` through, and the marker band's
// geometry, shared by the canvas style, the SVG export and the PNG drawer so the three agree.

export type TextGradientId = 'sunset' | 'ocean' | 'aurora' | 'berry' | 'ember' | 'midnight';

export type TextGradient = { id: TextGradientId; label: string; from: string; to: string };

// Left to right across the run. Fixed colours: a gradient headline is a deliberate look, chosen for
// the paper like a text colour (the spec's table).
export const TEXT_GRADIENTS: readonly TextGradient[] = [
  { id: 'sunset', label: 'Sunset', from: '#f97316', to: '#db2777' },
  { id: 'ocean', label: 'Ocean', from: '#0ea5e9', to: '#6366f1' },
  { id: 'aurora', label: 'Aurora', from: '#10b981', to: '#0ea5e9' },
  { id: 'berry', label: 'Berry', from: '#8b5cf6', to: '#ec4899' },
  { id: 'ember', label: 'Ember', from: '#f59e0b', to: '#dc2626' },
  { id: 'midnight', label: 'Midnight', from: '#1e3a8a', to: '#7c3aed' },
];

/** The preset a run's `gradient` names, or null for none or an id no renderer knows. */
export function textGradientOf(id: unknown): TextGradient | null {
  return (typeof id === 'string' && TEXT_GRADIENTS.find((g) => g.id === id)) || null;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Whether a run's `highlight` is a colour a renderer may paint (a 3 or 6 digit hex). */
export function isHighlightColour(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v);
}

// The marker band, as fractions of the line box (docs/specs/008-canvas/text-effects.md "Rendering"): it
// covers the lower part of the letters, the way a highlighter pen is drawn across a word.
export const HIGHLIGHT_BAND_TOP = 0.38;
export const HIGHLIGHT_BAND_BOTTOM = 0.94;
// Padding either side of the band, in em, and its corner radius (D127).
export const HIGHLIGHT_PAD_EM = 0.125;
export const HIGHLIGHT_RADIUS_EM = 0.2;

/** The band as a CSS background layer. */
export function highlightBandCss(colour: string): string {
  const top = `${HIGHLIGHT_BAND_TOP * 100}%`;
  const bottom = `${HIGHLIGHT_BAND_BOTTOM * 100}%`;
  return `linear-gradient(to bottom, transparent ${top}, ${colour} ${top}, ${colour} ${bottom}, transparent ${bottom})`;
}

/** A gradient preset as a CSS background layer, left to right. */
export function textGradientCss(g: Pick<TextGradient, 'from' | 'to'>): string {
  return `linear-gradient(90deg, ${g.from}, ${g.to})`;
}
