// A small, bounded XML reader for Office parts (docs/specs/020-import-export/blueprints/office-import.md "parseXml").
// It refuses any document type declaration, so no entity is ever expanded and nothing outside the file is loaded;
// it caps depth and element count; and it folds each known namespace to one canonical prefix, so the readers match
// `w:p` whatever prefixes the file chose (and strict OOXML reads like transitional). Pure: no DOM.

import { OfficeImportError } from './errors';
import { OFFICE_XML_MAX_DEPTH, OFFICE_XML_MAX_ELEMENTS } from './limits';

export type XmlElement = {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
};
export type XmlNode = XmlElement | string;

// Namespace URIs, transitional and strict, to the prefix the readers use.
const NAMESPACES: Record<string, string> = {
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main': 'w',
  'http://purl.oclc.org/ooxml/wordprocessingml/main': 'w',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships': 'r',
  'http://purl.oclc.org/ooxml/officeDocument/relationships': 'r',
  'http://schemas.openxmlformats.org/drawingml/2006/main': 'a',
  'http://purl.oclc.org/ooxml/drawingml/main': 'a',
  'http://schemas.openxmlformats.org/presentationml/2006/main': 'p',
  'http://purl.oclc.org/ooxml/presentationml/main': 'p',
  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing': 'wp',
  'http://purl.oclc.org/ooxml/drawingml/wordprocessingDrawing': 'wp',
  'http://schemas.openxmlformats.org/drawingml/2006/picture': 'pic',
  'http://purl.oclc.org/ooxml/drawingml/picture': 'pic',
  'http://schemas.openxmlformats.org/drawingml/2006/chart': 'c',
  'http://purl.oclc.org/ooxml/drawingml/chart': 'c',
  'http://schemas.openxmlformats.org/drawingml/2006/diagram': 'dgm',
  'http://purl.oclc.org/ooxml/drawingml/diagram': 'dgm',
  'http://schemas.openxmlformats.org/officeDocument/2006/math': 'm',
  'http://purl.oclc.org/ooxml/officeDocument/math': 'm',
  'http://schemas.openxmlformats.org/markup-compatibility/2006': 'mc',
  'http://schemas.microsoft.com/office/word/2010/wordprocessingShape': 'wps',
  'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup': 'wpg',
  'urn:schemas-microsoft-com:vml': 'v',
  'http://schemas.openxmlformats.org/package/2006/relationships': 'pr',
  'http://schemas.openxmlformats.org/package/2006/content-types': 'ct',
};

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Character references and the five predefined entities; anything else is kept as written. */
export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code =
        ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return ENTITIES[ref] ?? whole;
  });
}

// Text that is whitespace only is content inside these, and noise everywhere else.
const KEEPS_SPACE = new Set(['w:t', 'a:t', 'w:instrText']);

const ATTR = /\s*([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
const NAME = /[^\s/>]+/y;

const broken = () => new OfficeImportError('not-a-package');

type Scope = Map<string, string>;

function canonical(qname: string, scope: Scope, isAttr: boolean): string {
  const colon = qname.indexOf(':');
  // An unprefixed attribute is in no namespace; an unprefixed element is in the default one.
  if (colon < 0) {
    if (isAttr) return qname;
    const prefix = NAMESPACES[scope.get('') ?? ''];
    return prefix ? `${prefix}:${qname}` : qname;
  }
  const prefix = qname.slice(0, colon);
  if (prefix === 'xml' || prefix === 'xmlns') return qname;
  const known = NAMESPACES[scope.get(prefix) ?? ''];
  return known ? `${known}:${qname.slice(colon + 1)}` : qname;
}

/** The part's root element. Throws `not-a-package` for a DTD or malformed XML, `unpacks-too-large` past the caps. */
export function parseXml(text: string): XmlElement {
  const root: XmlElement = { name: '#root', attrs: {}, children: [] };
  const stack: { el: XmlElement; raw: string; scope: Scope }[] = [
    { el: root, raw: '#root', scope: new Map() },
  ];
  let count = 0;
  let at = 0;
  const len = text.length;
  while (at < len) {
    const lt = text.indexOf('<', at);
    const top = stack[stack.length - 1]!;
    if (lt < 0 || lt > at) {
      const raw = text.slice(at, lt < 0 ? len : lt);
      if (top.el !== root && (KEEPS_SPACE.has(top.el.name) || raw.trim() !== '')) {
        top.el.children.push(decodeEntities(raw));
      }
      if (lt < 0) break;
    }
    const next = text.charCodeAt(lt + 1);
    if (next === 63 /* ? */) {
      const close = text.indexOf('?>', lt + 2);
      if (close < 0) throw broken();
      at = close + 2;
      continue;
    }
    if (next === 33 /* ! */) {
      if (text.startsWith('<!--', lt)) {
        const close = text.indexOf('-->', lt + 4);
        if (close < 0) throw broken();
        at = close + 3;
        continue;
      }
      if (text.startsWith('<![CDATA[', lt)) {
        const close = text.indexOf(']]>', lt + 9);
        if (close < 0) throw broken();
        if (top.el !== root) top.el.children.push(text.slice(lt + 9, close));
        at = close + 3;
        continue;
      }
      // <!DOCTYPE, <!ENTITY and anything else: refused before anything is expanded.
      throw broken();
    }
    if (next === 47 /* / */) {
      const close = text.indexOf('>', lt + 2);
      if (close < 0) throw broken();
      const raw = text.slice(lt + 2, close).trim();
      if (stack.length <= 1 || top.raw !== raw) throw broken();
      stack.pop();
      at = close + 1;
      continue;
    }
    NAME.lastIndex = lt + 1;
    const nameMatch = NAME.exec(text);
    if (!nameMatch) throw broken();
    const raw = nameMatch[0];
    let pos = NAME.lastIndex;
    const rawAttrs: [string, string][] = [];
    let scope = top.scope;
    for (;;) {
      ATTR.lastIndex = pos;
      const m = ATTR.exec(text);
      if (!m) break;
      const key = m[1]!;
      const value = decodeEntities(m[2] ?? m[3] ?? '');
      if (key === 'xmlns' || key.startsWith('xmlns:')) {
        if (scope === top.scope) scope = new Map(top.scope);
        scope.set(key === 'xmlns' ? '' : key.slice(6), value);
      }
      rawAttrs.push([key, value]);
      pos = ATTR.lastIndex;
    }
    while (pos < len && /\s/.test(text[pos]!)) pos++;
    const selfClosing = text[pos] === '/';
    if (selfClosing) pos++;
    if (text[pos] !== '>') throw broken();
    at = pos + 1;
    if (++count > OFFICE_XML_MAX_ELEMENTS) throw new OfficeImportError('unpacks-too-large');
    const attrs: Record<string, string> = {};
    for (const [key, value] of rawAttrs) attrs[canonical(key, scope, true)] = value;
    const el: XmlElement = { name: canonical(raw, scope, false), attrs, children: [] };
    top.el.children.push(el);
    if (!selfClosing) {
      if (stack.length > OFFICE_XML_MAX_DEPTH) throw new OfficeImportError('unpacks-too-large');
      stack.push({ el, raw, scope });
    }
  }
  if (stack.length !== 1) throw broken();
  const first = root.children.find((c): c is XmlElement => typeof c !== 'string');
  if (!first) throw broken();
  return first;
}

// --- Walking helpers -------------------------------------------------------------------------------------------

/** The element children of `el`. */
export function kids(el: XmlElement | undefined): XmlElement[] {
  if (!el) return [];
  const out: XmlElement[] = [];
  for (const c of el.children) if (typeof c !== 'string') out.push(c);
  return out;
}

/** The first child named `name`. */
export function child(el: XmlElement | undefined, name: string): XmlElement | undefined {
  if (!el) return undefined;
  for (const c of el.children) if (typeof c !== 'string' && c.name === name) return c;
  return undefined;
}

/** The first element at the end of a path of child names. */
export function path(el: XmlElement | undefined, ...names: string[]): XmlElement | undefined {
  let at = el;
  for (const n of names) at = child(at, n);
  return at;
}

/** The first descendant named `name`, depth first. */
export function find(el: XmlElement | undefined, name: string): XmlElement | undefined {
  if (!el) return undefined;
  for (const c of el.children) {
    if (typeof c === 'string') continue;
    if (c.name === name) return c;
    const deeper = find(c, name);
    if (deeper) return deeper;
  }
  return undefined;
}

/** Every descendant named `name`, depth first. */
export function findAll(
  el: XmlElement | undefined,
  name: string,
  out: XmlElement[] = [],
): XmlElement[] {
  if (!el) return out;
  for (const c of el.children) {
    if (typeof c === 'string') continue;
    if (c.name === name) out.push(c);
    findAll(c, name, out);
  }
  return out;
}

/** The text directly inside `el`. */
export function textOf(el: XmlElement | undefined): string {
  if (!el) return '';
  let s = '';
  for (const c of el.children) if (typeof c === 'string') s += c;
  return s;
}

/** An integer attribute, or undefined. */
export function intAttr(el: XmlElement | undefined, name: string): number | undefined {
  const v = el?.attrs[name];
  if (v === undefined) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}
