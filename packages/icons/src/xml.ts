// The one XML escaper for every SVG string this monorepo builds.
//
// It was written three times before this module existed: once here in
// markup.ts (text nodes only, & < >), once in sticker-markup.ts (& < > " '),
// and once in each product's document package's svg-render-primitives (& < > ", for both
// text and attributes). Three subtly different answers to one question is how
// an escaping bug gets fixed in one exporter and not the others.
//
// It escapes the full set, so a single function is correct in BOTH positions a
// string can land in: a text node and a double- or single-quoted attribute
// value. Escaping an apostrophe inside a text node is unnecessary but never
// wrong, and paying those few bytes is worth not having to ask, at each call
// site, which of two escapers this one needs.
//
// Lives in @liveworkspace/icons because it is a leaf package with no
// dependencies of its own, and every product's document package already depends on it. The
// reverse home would invert that edge.
//
// It also drops every character XML 1.0 forbids outright (the C0 controls bar
// tab, LF and CR; U+FFFE and U+FFFF; and an unpaired surrogate). No escape can
// carry those: `&#11;` is just as ill-formed as the raw byte, so one stray
// vertical tab pasted into a label would otherwise make the whole downloaded
// SVG fail to parse.
// oxlint-disable-next-line no-control-regex -- matching control characters is the point.
const NOT_XML_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDFFF]/gu;

export function xmlEscape(s: string): string {
  return s
    .replace(NOT_XML_CHAR, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
