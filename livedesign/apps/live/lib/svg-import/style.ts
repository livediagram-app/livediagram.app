// SVG style, read the way the browser cascades it (docs/specs/020-import-export/svg-import.md "Style"): a
// presentation attribute, beaten by a matching `<style>` rule (more specific and later rules winning), beaten by the
// `style` attribute; an element inherits what it does not set. `<style>` takes simple selectors only (a tag,
// `.class`, `#id`, or one compound of them, in comma lists); a rule with any other selector is ignored. Parsed by
// hand with indexOf; no regular expressions.

/** The properties SVG import reads. */
export const STYLE_PROPERTIES = [
  'fill',
  'stroke',
  'stroke-width',
  'fill-rule',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'color',
  'display',
  'visibility',
  'clip-path',
  'mask',
  'filter',
  'stop-color',
  'stop-opacity',
] as const;
export type StyleProperty = (typeof STYLE_PROPERTIES)[number];
export type Declarations = Partial<Record<StyleProperty, string>>;

const KNOWN = new Set<string>(STYLE_PROPERTIES);

/** The declarations of a `style` attribute or a rule body, the properties SVG import reads only. */
export function parseDeclarations(body: string): Declarations {
  const out: Declarations = {};
  for (const part of body.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    if (!KNOWN.has(prop)) continue;
    let value = part.slice(colon + 1).trim();
    const bang = value.indexOf('!');
    if (bang >= 0) value = value.slice(0, bang).trim();
    if (value) out[prop as StyleProperty] = value;
  }
  return out;
}

type Compound = { tag?: string; id?: string; classes: string[] };
type Rule = { compound: Compound; specificity: number; order: number; decls: Declarations };

const isIdentChar = (c: string) =>
  (c >= 'a' && c <= 'z') ||
  (c >= 'A' && c <= 'Z') ||
  (c >= '0' && c <= '9') ||
  c === '-' ||
  c === '_';

// A simple compound selector (`path`, `.a`, `#b`, `path.a.b`), or null for anything else.
function parseCompound(sel: string): Compound | null {
  const out: Compound = { classes: [] };
  let i = 0;
  const ident = () => {
    const from = i;
    while (i < sel.length && isIdentChar(sel[i]!)) i++;
    return sel.slice(from, i);
  };
  if (sel[0] !== '.' && sel[0] !== '#') {
    const tag = ident();
    if (!tag) return null;
    out.tag = tag.toLowerCase();
  }
  while (i < sel.length) {
    const c = sel[i++];
    const name = ident();
    if (!name) return null;
    if (c === '.') out.classes.push(name);
    else if (c === '#' && !out.id) out.id = name;
    else return null;
  }
  return out.tag || out.id || out.classes.length ? out : null;
}

function stripComments(css: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const open = css.indexOf('/*', i);
    if (open < 0) return out + css.slice(i);
    out += css.slice(i, open);
    const close = css.indexOf('*/', open + 2);
    if (close < 0) return out;
    i = close + 2;
  }
}

/** The file's `<style>` rules, indexed for matching. */
export class StyleSheet {
  private readonly byKey = new Map<string, Rule[]>();
  private order = 0;

  /** Adds one `<style>` element's text. At-rules (`@media`, `@font-face`) are skipped whole. */
  add(cssText: string): void {
    const css = stripComments(cssText);
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf('{', i);
      if (open < 0) break;
      const prelude = css.slice(i, open).trim();
      // The matching close, counting nested blocks (an at-rule's body).
      let depth = 1;
      let j = open + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      // An unclosed block runs to the end of the text.
      const body = css.slice(open + 1, depth > 0 ? j : j - 1);
      i = j;
      if (prelude.startsWith('@') || body.includes('{')) continue;
      const decls = parseDeclarations(body);
      if (Object.keys(decls).length === 0) continue;
      for (const raw of prelude.split(',')) {
        const compound = parseCompound(raw.trim());
        if (!compound) continue;
        const specificity =
          (compound.id ? 10_000 : 0) + compound.classes.length * 100 + (compound.tag ? 1 : 0);
        const rule: Rule = { compound, specificity, order: this.order++, decls };
        const key = compound.id
          ? `#${compound.id}`
          : compound.classes.length
            ? `.${compound.classes[0]}`
            : compound.tag!;
        const list = this.byKey.get(key);
        if (list) list.push(rule);
        else this.byKey.set(key, [rule]);
      }
    }
  }

  /** The rules matching an element, merged in cascade order (least specific, earliest first). */
  match(tag: string, id: string | null, classes: readonly string[]): Declarations {
    if (this.byKey.size === 0) return {};
    const found: Rule[] = [];
    const take = (key: string) => {
      for (const r of this.byKey.get(key) ?? []) {
        const c = r.compound;
        if (c.tag && c.tag !== tag) continue;
        if (c.id && c.id !== id) continue;
        if (!c.classes.every((k) => classes.includes(k))) continue;
        if (!found.includes(r)) found.push(r);
      }
    };
    take(tag);
    if (id) take(`#${id}`);
    for (const k of classes) take(`.${k}`);
    found.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
    return Object.assign({}, ...found.map((r) => r.decls)) as Declarations;
  }
}
