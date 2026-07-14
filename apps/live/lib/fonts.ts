// Curated text fonts (spec/28). Each text-bearing element and each tab
// can pick one; the id is stored in the model and mapped to a CSS stack
// here at render time. Eleven Google Fonts spanning neutral / geometric /
// rounded / condensed / techy sans, serif / display serif / slab, mono,
// and handwriting / marker — a wide enough spread that a diagram can take
// on a distinct voice without an open-ended font field.
//
// Fonts are a progressive enhancement: the stack always ends in a system
// fallback and the stylesheet loads with `display=swap`, so if Google
// Fonts is blocked (or a self-host opts out) text still renders — just in
// the fallback face. Browsers only fetch a family that's actually applied.

type FontOption = {
  // Stable id stored in the model (Element.font / Tab.font).
  id: string;
  label: string;
  // Short descriptor shown under the label in the picker.
  kind: string;
  // CSS font-family value applied at render: the Google family first,
  // then graceful fallbacks while it loads / if it's blocked.
  stack: string;
  // `family=` spec for the Google Fonts CSS API (name + weights). Weights
  // cover the editor's regular (400), medium (500), and bold (700) text.
  google: string;
};

export const FONTS: readonly FontOption[] = [
  {
    id: 'inter',
    label: 'Inter',
    kind: 'Sans-serif',
    stack: "'Inter', ui-sans-serif, system-ui, sans-serif",
    google: 'Inter:wght@400;500;700',
  },
  {
    id: 'poppins',
    label: 'Poppins',
    kind: 'Geometric',
    stack: "'Poppins', ui-sans-serif, system-ui, sans-serif",
    google: 'Poppins:wght@400;500;700',
  },
  {
    id: 'nunito',
    label: 'Nunito',
    kind: 'Rounded',
    stack: "'Nunito', ui-sans-serif, system-ui, sans-serif",
    google: 'Nunito:wght@400;500;700',
  },
  {
    id: 'oswald',
    label: 'Oswald',
    kind: 'Condensed',
    stack: "'Oswald', ui-sans-serif, system-ui, sans-serif",
    google: 'Oswald:wght@400;500;700',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    kind: 'Techy sans',
    stack: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
    google: 'Space+Grotesk:wght@400;500;700',
  },
  {
    id: 'lora',
    label: 'Lora',
    kind: 'Serif',
    stack: "'Lora', ui-serif, Georgia, serif",
    google: 'Lora:wght@400;500;700',
  },
  {
    id: 'abril-fatface',
    label: 'Abril Fatface',
    kind: 'Display serif',
    stack: "'Abril Fatface', ui-serif, Georgia, serif",
    // A dramatic fat-face didone, chosen over a second book serif (Playfair)
    // so the display option reads as clearly distinct from Lora rather than a
    // near-twin. Ships a single weight, so it has no :wght@ axis; the editor's
    // medium/bold reuse that one face.
    google: 'Abril+Fatface',
  },
  {
    id: 'roboto-slab',
    label: 'Roboto Slab',
    kind: 'Slab serif',
    stack: "'Roboto Slab', ui-serif, Georgia, serif",
    google: 'Roboto+Slab:wght@400;500;700',
  },
  {
    id: 'roboto-mono',
    label: 'Roboto Mono',
    kind: 'Monospace',
    stack: "'Roboto Mono', ui-monospace, SFMono-Regular, monospace",
    google: 'Roboto+Mono:wght@400;500;700',
  },
  {
    id: 'caveat',
    label: 'Caveat',
    kind: 'Handwriting',
    stack: "'Caveat', ui-sans-serif, cursive",
    google: 'Caveat:wght@400;500;700',
  },
  {
    id: 'permanent-marker',
    label: 'Permanent Marker',
    kind: 'Marker',
    stack: "'Permanent Marker', ui-sans-serif, cursive",
    // Permanent Marker ships a single weight, so it has no :wght@ axis;
    // the editor's medium/bold just reuse that one face.
    google: 'Permanent+Marker',
  },
];

const BY_ID = new Map(FONTS.map((f) => [f.id, f] as const));

// Map a stored font id to its CSS stack. Returns undefined for unset /
// unknown ids so callers can fall back (element → tab → CSS default)
// instead of forcing a family onto text that never chose one.
export function resolveFontStack(id: string | undefined | null): string | undefined {
  if (!id) return undefined;
  return BY_ID.get(id)?.stack;
}

// The single Google Fonts stylesheet href covering every option. One
// request defines every @font-face; the browser only downloads the
// families actually applied to elements.
export function googleFontsHref(): string {
  const families = FONTS.map((f) => `family=${f.google}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
