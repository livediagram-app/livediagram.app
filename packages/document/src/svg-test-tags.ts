// Test helpers for reading rendered SVG without regexes that scan across tags (a pattern like
// `<text[^>]*y="…"[^>]*>` is polynomial on repeated attributes): tags are found by index, and each
// tag's attributes are read inside its own `<…>` only.

export type SvgTag = Record<string, string>;

function attributesOf(tag: string): SvgTag {
  const out: SvgTag = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]!] = m[2]!;
  return out;
}

// Every `<name …>` tag in the markup, as its attributes.
export function svgTags(svg: string, name: string): SvgTag[] {
  const tags: SvgTag[] = [];
  const open = `<${name}`;
  for (let i = svg.indexOf(open); i >= 0; i = svg.indexOf(open, i + open.length)) {
    const next = svg[i + open.length];
    if (next !== ' ' && next !== '>' && next !== '/') continue;
    const end = svg.indexOf('>', i);
    if (end < 0) break;
    tags.push(attributesOf(svg.slice(i, end)));
  }
  return tags;
}

// The `<text>` tag whose content starts with the given words (directly or in its first <tspan>).
export function textTagBefore(svg: string, words: string): SvgTag | null {
  const at = svg.indexOf(words);
  if (at < 0) return null;
  const open = svg.lastIndexOf('<text', at);
  if (open < 0) return null;
  return attributesOf(svg.slice(open, svg.indexOf('>', open)));
}
