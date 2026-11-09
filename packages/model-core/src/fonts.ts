// Curated text fonts (docs/specs/004-interface-design/fonts.md). Each text-bearing element and each tab
// can pick one; the id is stored in the model and mapped to a CSS stack
// here at render time. Eleven Google Fonts spanning neutral / geometric /
// rounded / condensed / techy sans, serif / display serif / slab, mono,
// and handwriting / marker: a wide enough spread that a canvas can take
// on a distinct voice without an open-ended font field. Every face must
// read at 12 px and at 50% zoom (fonts.md "Legible at every size").
//
// Fonts are a progressive enhancement: the stack always ends in a system
// fallback and the stylesheet loads with `display=swap`, so if Google
// Fonts is blocked (or a deployment opts out) text still renders, just in
// the fallback face. Browsers only fetch a family that's actually applied.

type FontOption = {
  // Stable id stored in the model (Element.font / Tab.font). A storage key, not
  // a name: a face can be swapped behind its id without touching saved text.
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
    // The id once named Abril Fatface, whose hairlines vanished and counters filled in below 16 px
    // (fonts.md "Legible at every size"). Ids are storage keys, so saved text keeps the id and draws in
    // Bodoni Moda: the same fat didone at headline size, and its optical-size axis (opsz 6..96, applied
    // automatically by font-optical-sizing) thickens the hairlines and opens the counters at small px.
    // One weight, like the face it replaces: regular and bold letter the same, never a synthesised bold.
    label: 'Bodoni Moda',
    kind: 'Display serif',
    stack: "'Bodoni Moda', ui-serif, Georgia, serif",
    google: 'Bodoni+Moda:opsz,wght@6..96,800',
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
    // The id once named Caveat, whose lowercase is 0.36 em (Inter's is 0.55), so a 14 px label drew like
    // 9 px. Kalam is a pen hand of the same informal character with a 0.51 em lowercase. The fallbacks are
    // system hands that read, ahead of the generic cursive.
    label: 'Kalam',
    kind: 'Handwriting',
    stack: "'Kalam', 'Chalkboard SE', 'Segoe Print', 'Comic Sans MS', cursive",
    google: 'Kalam:wght@400;700',
  },
  {
    id: 'permanent-marker',
    // The id once named Permanent Marker: capitals only, with a 1, 3 and 0 that read as l, ʒ and O, and
    // letters that clogged below 16 px. Shantell Sans is a marker hand with a lowercase and clear figures,
    // loaded at one heavy weight (700) so every label reads as felt-tip, as the old single-weight face did.
    label: 'Shantell Sans',
    kind: 'Marker',
    stack: "'Shantell Sans', 'Chalkboard SE', 'Segoe Print', 'Comic Sans MS', cursive",
    google: 'Shantell+Sans:wght@700',
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
export function googleFontsHref(ids?: readonly string[]): string {
  // A subset (an export declaring only the faces it used) or, by default,
  // the whole catalogue (the editor, which can't know what you'll pick).
  const wanted = ids ? FONTS.filter((f) => ids.includes(f.id)) : FONTS;
  const families = wanted.map((f) => `family=${f.google}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

// The font ids a set of elements + their tab actually use (docs/specs/004-interface-design/fonts.md), in
// catalogue order. An export declares exactly these and no more: a
// downloaded SVG shouldn't pull eleven families to draw a canvas that used
// one, and the empty case must stay byte-identical to a font-less export.
export function fontIdsUsed(
  elements: readonly { font?: string }[],
  tabFont?: string,
  extra?: readonly (string | null | undefined)[],
): string[] {
  const used = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id && BY_ID.has(id)) used.add(id);
  };
  add(tabFont);
  for (const el of elements) add(el.font);
  for (const id of extra ?? []) add(id);
  return FONTS.filter((f) => used.has(f.id)).map((f) => f.id);
}
