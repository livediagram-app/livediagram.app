// A Word package's styles, numbering and run properties, read into the few answers the article needs
// (docs/specs/020-import-export/blueprints/office-import.md "readDocx"): what kind of paragraph a style makes, whether
// a list is bulleted or numbered, and which marks a run carries.

import type { ArticleListKind, ArticleParagraphStyle, ArticleRun } from '@livedocuments/document';
import { child, intAttr, kids, type XmlElement } from './xml';

/** What a paragraph style makes in the article. */
export type ParagraphRole = { style?: ArticleParagraphStyle; code?: true };

type StyleEntry = {
  name: string;
  basedOn?: string;
  outline?: number;
  numPr?: XmlElement;
  rPr?: XmlElement;
};

export type DocxStyles = {
  /** The role of a paragraph style (by id), following its `basedOn` chain. */
  roleOf(styleId: string | undefined, outline?: number): ParagraphRole;
  /** The numbering a paragraph style carries, when the paragraph has none of its own. */
  numPrOf(styleId: string | undefined): XmlElement | undefined;
  /** The run properties of a character style (its own, then what it is based on). */
  runStyle(styleId: string | undefined): XmlElement[];
};

// Fonts that make a run code (D64): any named "mono", or one of these.
const MONO_FONTS = new Set([
  'courier',
  'courier new',
  'consolas',
  'monaco',
  'menlo',
  'lucida console',
  'inconsolata',
  'source code pro',
  'fira code',
  'andale mono',
  'cascadia code',
]);

export function isMonoFont(font: string | undefined): boolean {
  if (!font) return false;
  const f = font.trim().toLowerCase();
  return f.includes('mono') || MONO_FONTS.has(f);
}

const CODE_STYLE_NAMES = new Set([
  'code',
  'html preformatted',
  'source code',
  'macro text',
  'code block',
]);

/** The role a style's name gives, or undefined. */
function roleOfName(name: string): ParagraphRole | undefined {
  const n = name.trim().toLowerCase();
  if (n === 'title') return { style: 'title' };
  if (n === 'subtitle') return { style: 'subtitle' };
  if (n === 'quote' || n === 'intense quote') return { style: 'quote' };
  if (CODE_STYLE_NAMES.has(n)) return { code: true };
  const heading = /^heading\s?([1-9])$/.exec(n);
  if (heading) return headingRole(Number(heading[1]) - 1);
  return undefined;
}

function headingRole(outline: number): ParagraphRole {
  return { style: outline <= 0 ? 'h1' : outline === 1 ? 'h2' : 'h3' };
}

const FONT_KEYS = ['w:ascii', 'w:hAnsi', 'w:cs'];
function fontOf(rPr: XmlElement | undefined): string | undefined {
  const fonts = child(rPr, 'w:rFonts');
  if (!fonts) return undefined;
  for (const k of FONT_KEYS) if (fonts.attrs[k]) return fonts.attrs[k];
  return undefined;
}

export function readStyles(root: XmlElement | undefined): DocxStyles {
  const byId = new Map<string, StyleEntry>();
  for (const s of kids(root)) {
    if (s.name !== 'w:style') continue;
    const id = s.attrs['w:styleId'];
    if (!id) continue;
    const pPr = child(s, 'w:pPr');
    byId.set(id, {
      name: child(s, 'w:name')?.attrs['w:val'] ?? id,
      basedOn: child(s, 'w:basedOn')?.attrs['w:val'],
      outline: intAttr(child(pPr, 'w:outlineLvl'), 'w:val'),
      numPr: child(pPr, 'w:numPr'),
      rPr: child(s, 'w:rPr'),
    });
  }
  // A style's chain: itself, then what it is based on, at most 10 deep (a loop stops there too).
  const chain = (id: string | undefined): StyleEntry[] => {
    const out: StyleEntry[] = [];
    let at = id;
    while (at && out.length < 10) {
      const s = byId.get(at);
      if (!s) break;
      out.push(s);
      at = s.basedOn;
    }
    return out;
  };
  return {
    roleOf(styleId, outline) {
      const styles = chain(styleId);
      for (const s of styles) {
        const role = roleOfName(s.name);
        if (role) return role;
      }
      if (outline !== undefined && outline >= 0 && outline < 9) return headingRole(outline);
      for (const s of styles) {
        if (s.outline !== undefined && s.outline >= 0 && s.outline < 9)
          return headingRole(s.outline);
        if (isMonoFont(fontOf(s.rPr))) return { code: true };
      }
      // No styles part (or no such style): the id read as a name ("Heading1", "Title").
      if (styles.length === 0 && styleId) return roleOfName(styleId) ?? {};
      return {};
    },
    numPrOf(styleId) {
      for (const s of chain(styleId)) if (s.numPr) return s.numPr;
      return undefined;
    },
    runStyle(styleId) {
      return chain(styleId)
        .map((s) => s.rPr)
        .filter((r): r is XmlElement => !!r);
    },
  };
}

export type DocxNumbering = {
  /** The list kind of a numbering at a level, or null for "no list" (`numFmt` none, or numId 0). */
  kindOf(numId: string, level: number): ArticleListKind | null;
};

export function readNumbering(root: XmlElement | undefined): DocxNumbering {
  const abstract = new Map<string, Map<number, string>>();
  const nums = new Map<string, string>();
  for (const el of kids(root)) {
    if (el.name === 'w:abstractNum') {
      const levels = new Map<number, string>();
      for (const lvl of kids(el)) {
        if (lvl.name !== 'w:lvl') continue;
        const at = intAttr(lvl, 'w:ilvl') ?? 0;
        levels.set(at, child(lvl, 'w:numFmt')?.attrs['w:val'] ?? 'bullet');
      }
      abstract.set(el.attrs['w:abstractNumId'] ?? '', levels);
    } else if (el.name === 'w:num') {
      const ref = child(el, 'w:abstractNumId')?.attrs['w:val'];
      if (el.attrs['w:numId'] && ref !== undefined) nums.set(el.attrs['w:numId'], ref);
    }
  }
  return {
    kindOf(numId, level) {
      if (numId === '0') return null;
      const ref = nums.get(numId);
      const fmt = ref === undefined ? undefined : abstract.get(ref)?.get(level);
      if (fmt === 'none') return null;
      // A level the numbering part does not define is bulleted (D63).
      if (fmt === undefined || fmt === 'bullet') return 'bullet';
      return 'numbered';
    },
  };
}

// A toggle property is on unless its value says off.
function on(el: XmlElement | undefined): boolean {
  if (!el) return false;
  const v = el.attrs['w:val'];
  return v === undefined || !['0', 'false', 'off', 'none'].includes(v.toLowerCase());
}

type RunMarks = Omit<ArticleRun, 'text' | 'href' | 'color' | 'hl' | 'note' | 'nk'>;

/** The marks run properties carry, their character style's first (the run's own win). */
export function runMarks(rPr: XmlElement | undefined, styles: DocxStyles): RunMarks {
  const rStyle = child(rPr, 'w:rStyle')?.attrs['w:val'];
  const layers = [...styles.runStyle(rStyle).reverse(), ...(rPr ? [rPr] : [])];
  const marks: RunMarks = {};
  const set = (flag: keyof RunMarks, value: boolean) => {
    if (value) marks[flag] = true;
    else delete marks[flag];
  };
  const named = rStyle?.toLowerCase();
  if (named === 'strong') marks.b = true;
  if (named === 'emphasis') marks.i = true;
  for (const layer of layers) {
    for (const p of kids(layer)) {
      switch (p.name) {
        case 'w:b':
          set('b', on(p));
          break;
        case 'w:i':
          set('i', on(p));
          break;
        case 'w:u':
          set('u', on(p));
          break;
        case 'w:strike':
        case 'w:dstrike':
          set('s', on(p));
          break;
        case 'w:vertAlign': {
          const v = p.attrs['w:val'];
          set('sup', v === 'superscript');
          set('sub', v === 'subscript');
          break;
        }
        case 'w:rFonts':
          set('code', isMonoFont(fontOf(layer)));
          break;
      }
    }
  }
  return marks;
}
