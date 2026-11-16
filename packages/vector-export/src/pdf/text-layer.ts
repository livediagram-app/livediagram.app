// The invisible text layer (liveworkspace/docs/specs/013-export/vector-pdf.md "Text"): every character the page shows, set in invisible text
// (render mode 3, the way a scanned page is made searchable) over the outlines that draw it, so a reader can select,
// copy and search it and a screen reader can read it. The face is a Type 3 font of empty glyphs, each half an em
// wide, its codes mapped back to Unicode by a ToUnicode CMap; each line is stretched (Tz) to the width the outlines
// span, so a selection covers what it shows.
import { num } from './matrix';
import type { PdfFile } from './pdf-file';
import type { PdfResources } from './pdf-resources';

/** A run of text on one baseline, in PDF points on the page (y up): from its first character's start to its last's end. */
export type TextItem = {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  size: number;
  // The structure the writing knows for it (H1, P...), and which block it belongs to.
  tag?: string;
  block?: string;
};

// Each glyph's advance, in the font's thousandths of an em.
const ADVANCE = 500;
// Codes per font: one byte, 0 left out.
const CODES_PER_FONT = 255;

const utf16Hex = (ch: string) => {
  let hex = '';
  for (let i = 0; i < ch.length; i++)
    hex += ch.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return hex;
};
const byteHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();

/** The Type 3 fonts the text layer's characters are coded in: each distinct character gets one code, 255 to a font. */
export class InvisibleFonts {
  private readonly codes = new Map<string, { font: number; code: number }>();
  private readonly fonts: { obj: number; name: string; chars: string[] }[] = [];

  private readonly file: PdfFile;
  private readonly res: PdfResources;

  constructor(file: PdfFile, res: PdfResources) {
    this.file = file;
    this.res = res;
  }

  private codeOf(ch: string): { font: number; code: number } {
    const hit = this.codes.get(ch);
    if (hit) return hit;
    let last = this.fonts[this.fonts.length - 1];
    if (!last || last.chars.length >= CODES_PER_FONT) {
      const obj = this.file.alloc();
      last = { obj, name: this.res.name('Font', obj), chars: [] };
      this.fonts.push(last);
    }
    last.chars.push(ch);
    const c = { font: this.fonts.length - 1, code: last.chars.length };
    this.codes.set(ch, c);
    return c;
  }

  /** `text` as runs of one font each: its resource name and the codes in hex. */
  encode(text: string): { name: string; hex: string }[] {
    const runs: { name: string; hex: string }[] = [];
    for (const ch of text) {
      const { font, code } = this.codeOf(ch);
      const name = this.fonts[font]!.name;
      const last = runs[runs.length - 1];
      if (last && last.name === name) last.hex += byteHex(code);
      else runs.push({ name, hex: byteHex(code) });
    }
    return runs;
  }

  /** Writes every font used. */
  write(): void {
    if (this.fonts.length === 0) return;
    const glyph = this.file.putStream(this.file.alloc(), '', `${ADVANCE} 0 d0`);
    for (const f of this.fonts) {
      const n = f.chars.length;
      const names = f.chars.map((_, i) => `/g${i + 1}`).join(' ');
      const procs = f.chars.map((_, i) => `/g${i + 1} ${glyph} 0 R`).join(' ');
      const lines: string[] = [];
      for (let i = 0; i < n; i += 100) {
        const block = f.chars.slice(i, i + 100);
        lines.push(`${block.length} beginbfchar`);
        block.forEach((ch, j) => lines.push(`<${byteHex(i + j + 1)}> <${utf16Hex(ch)}>`));
        lines.push('endbfchar');
      }
      const cmap = [
        '/CIDInit /ProcSet findresource begin',
        '12 dict begin',
        'begincmap',
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
        '/CMapName /Adobe-Identity-UCS def',
        '/CMapType 2 def',
        '1 begincodespacerange',
        '<00> <FF>',
        'endcodespacerange',
        ...lines,
        'endcmap',
        'CMapName currentdict /CMap defineresource pop',
        'end',
        'end',
      ].join('\n');
      const toUnicode = this.file.putStream(this.file.alloc(), '', cmap);
      this.file.put(
        f.obj,
        `<< /Type /Font /Subtype /Type3 /FontBBox [0 -200 ${ADVANCE} 800] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << ${procs} >> /Encoding << /Type /Encoding /Differences [1 ${names}] >> /FirstChar 1 /LastChar ${n} /Widths [${Array(n).fill(ADVANCE).join(' ')}] /ToUnicode ${toUnicode} 0 R /Resources << >> >>`,
      );
    }
  }
}

/** The runs in reading order: those an article tags are put in the order of their blocks (a list item's number with
 *  its words, though the writing draws every number first), each keeping the slots tagged runs held; the rest stay. */
export function readingOrder(items: readonly TextItem[]): TextItem[] {
  const slots: number[] = [];
  const tagged: TextItem[] = [];
  items.forEach((it, i) => {
    if (it.block !== undefined && Number.isFinite(Number(it.block))) {
      slots.push(i);
      tagged.push(it);
    }
  });
  if (tagged.length < 2) return [...items];
  // Array.prototype.sort is stable: a block's runs keep their order.
  tagged.sort((a, b) => Number(a.block) - Number(b.block));
  const out = [...items];
  slots.forEach((slot, k) => (out[slot] = tagged[k]!));
  return out;
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

/** Neighbouring runs on one baseline joined into lines, a space where the gap between them is a word's: words laid out
 *  one by one read back as the sentence they make. Runs of different blocks never join. */
export function mergeLines(items: readonly TextItem[]): TextItem[] {
  const out: TextItem[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.block === it.block &&
      prev.tag === it.tag &&
      Math.abs(prev.size - it.size) <= 0.2 * prev.size
    ) {
      const len = dist(prev.x0, prev.y0, prev.x1, prev.y1);
      // The line's direction, or rightward for a line too short to have one.
      const ux = len > 1e-6 ? (prev.x1 - prev.x0) / len : 1;
      const uy = len > 1e-6 ? (prev.y1 - prev.y0) / len : 0;
      const dx = it.x0 - prev.x1;
      const dy = it.y0 - prev.y1;
      const along = dx * ux + dy * uy;
      const across = Math.abs(-dx * uy + dy * ux);
      const ilen = dist(it.x0, it.y0, it.x1, it.y1);
      const sameWay = ilen < 1e-6 || ((it.x1 - it.x0) * ux + (it.y1 - it.y0) * uy) / ilen > 0.995;
      if (
        sameWay &&
        across < 0.3 * prev.size &&
        along > -0.3 * prev.size &&
        along < 3 * prev.size
      ) {
        const space =
          along > 0.1 * prev.size && !prev.text.endsWith(' ') && !it.text.startsWith(' ');
        prev.text += (space ? ' ' : '') + it.text;
        prev.x1 = it.x1;
        prev.y1 = it.y1;
        continue;
      }
    }
    out.push({ ...it });
  }
  return out;
}

/** One line in invisible text: positioned at its start, turned along its baseline, stretched to its width. */
export function lineOps(line: TextItem, fonts: InvisibleFonts): string {
  const count = [...line.text].length;
  if (count === 0 || line.size <= 0) return '';
  const len = dist(line.x0, line.y0, line.x1, line.y1);
  const cos = len > 1e-6 ? (line.x1 - line.x0) / len : 1;
  const sin = len > 1e-6 ? (line.y1 - line.y0) / len : 0;
  const natural = (count * ADVANCE * line.size) / 1000;
  const stretch = len > 1e-6 ? (100 * len) / natural : 100;
  const out = [
    `${num(stretch)} Tz`,
    `${[cos, sin, -sin, cos, line.x0, line.y0].map(num).join(' ')} Tm`,
  ];
  for (const run of fonts.encode(line.text))
    out.push(`/${run.name} ${num(line.size)} Tf <${run.hex}> Tj`);
  return out.join('\n');
}

/** The page's text layer: each line in a text object of its own, wrapped by `mark` (its tags) when given. */
export function textLayerOps(
  lines: readonly TextItem[],
  fonts: InvisibleFonts,
  mark?: (line: TextItem, index: number) => { open: string; close: string },
): string {
  const out: string[] = [];
  for (const [i, line] of lines.entries()) {
    const ops = lineOps(line, fonts);
    if (!ops) continue;
    const m = mark?.(line, i);
    if (m) out.push(m.open);
    out.push('BT', '3 Tr', ops, 'ET');
    if (m) out.push(m.close);
  }
  return out.join('\n');
}
