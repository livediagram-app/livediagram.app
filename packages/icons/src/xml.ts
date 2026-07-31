// The one XML escaper for every SVG string this monorepo builds.
//
// It was written three times before this module existed: once here in
// markup.ts (text nodes only, & < >), once in sticker-markup.ts (& < > " '),
// and once in @livediagram/diagram's svg-render-primitives (& < > ", for both
// text and attributes). Three subtly different answers to one question is how
// an escaping bug gets fixed in one exporter and not the others.
//
// It escapes the full set, so a single function is correct in BOTH positions a
// string can land in: a text node and a double- or single-quoted attribute
// value. Escaping an apostrophe inside a text node is unnecessary but never
// wrong, and paying those few bytes is worth not having to ask, at each call
// site, which of two escapers this one needs.
//
// Lives in @livediagram/icons because it is a leaf package with no
// dependencies of its own, and @livediagram/diagram already depends on it. The
// reverse home would invert that edge.
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
