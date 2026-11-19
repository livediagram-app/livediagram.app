// Tags (liveworkspace/docs/specs/013-export/vector-pdf.md "Tags"): where the page knows its structure (an article's
// blocks, a described picture), the PDF is tagged. Each line of the text layer is marked content of its tag path's
// leaf element (a heading, a paragraph, a list item's body, a table cell), every described picture is a Figure with
// its alt text, the outlines and every other drawing are artifacts, and the structure tree lists the elements in
// reading order, an element running over two pages keeping one element. A PDF with neither stays untagged.
import { pdfTextString, type PdfFile } from './pdf-file';
import type { TextItem } from './text-layer';

// The tags a path may name: leaves and containers alike.
const TAGS = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'P',
  'BlockQuote',
  'L',
  'LI',
  'Lbl',
  'LBody',
  'Table',
  'TR',
  'TH',
  'TD',
]);

/** A tag the writer can use, or P. */
export const structTag = (tag: string | undefined): string => (tag && TAGS.has(tag) ? tag : 'P');

type Mcr = { page: number; mcid: number };
type Elem = {
  obj: number;
  tag: string;
  // Its parent element, or null for the Document.
  parent: Elem | null;
  kids: (Mcr | Elem)[];
  // A Figure's alt texts, joined when written (a group's described pictures).
  alts?: string[];
};
type Segment = { tag: string; key: string | null };
type Page = {
  pageObj: number;
  // Each MCID's element, in order: the parent tree's entry.
  mcids: Elem[];
  // Top-level elements first met on this page, with the top of their first line (PDF points, y up).
  blocks: { elem: Elem; top: number }[];
  figures: { elem: Elem; top: number }[];
  // To take the page back: element keys added, and each touched element's kid count before it.
  added: string[];
  touched: Map<Elem, number>;
};

/** A tag path (`L#l0/LI#i4/LBody`): its segments outermost first. An unknown leaf reads as P; an unknown container
 *  is left out. */
export function parseTagPath(path: string | undefined): Segment[] {
  const parts = (path ?? '').split('/');
  const out: Segment[] = [];
  parts.forEach((part, i) => {
    const hash = part.indexOf('#');
    const name = hash === -1 ? part : part.slice(0, hash);
    const key = hash === -1 ? null : part.slice(hash + 1) || null;
    const leaf = i === parts.length - 1;
    if (TAGS.has(name)) out.push({ tag: name, key });
    else if (leaf) out.push({ tag: 'P', key });
  });
  return out;
}

export class StructTree {
  private readonly elems = new Map<string, Elem>();
  // The Document's children, in reading order.
  private readonly order: Elem[] = [];
  private readonly pages: Page[] = [];
  private readonly paths = new Map<string, Segment[]>();
  readonly root: number;

  private readonly file: PdfFile;

  constructor(file: PdfFile) {
    this.file = file;
    this.root = file.alloc();
  }

  /** Starts a page's marked content; returns its StructParents index. */
  beginPage(pageObj: number): number {
    this.pages.push({ pageObj, mcids: [], blocks: [], figures: [], added: [], touched: new Map() });
    return this.pages.length - 1;
  }

  private get page(): Page {
    return this.pages[this.pages.length - 1]!;
  }

  private addKid(parent: Elem, kid: Mcr | Elem): void {
    const page = this.page;
    if (!page.touched.has(parent)) page.touched.set(parent, parent.kids.length);
    parent.kids.push(kid);
  }

  private newElem(tag: string, parent: Elem | null, key: string | null): Elem {
    const elem: Elem = { obj: this.file.alloc(), tag, parent, kids: [] };
    if (key !== null) {
      this.elems.set(key, elem);
      this.page.added.push(key);
    }
    if (parent) this.addKid(parent, elem);
    return elem;
  }

  private mcid(elem: Elem): { open: string; close: string } {
    const page = this.page;
    const mcid = page.mcids.length;
    page.mcids.push(elem);
    this.addKid(elem, { page: page.pageObj, mcid });
    return { open: `/${elem.tag} << /MCID ${mcid} >> BDC`, close: 'EMC' };
  }

  /** The marked-content operators around one line of the current page's text layer. */
  mark(line: TextItem, fallbackKey: string): { open: string; close: string } {
    return this.mcid(this.elemOf(line, fallbackKey));
  }

  /** Makes sure a line's element is in the tree with no content of its own: an empty table cell, so every row
   *  keeps its cells. */
  declare(line: TextItem, fallbackKey: string): void {
    this.elemOf(line, fallbackKey);
  }

  /** The leaf element of the line's tag path, made (with any container it lacks) when first met. */
  private elemOf(line: TextItem, fallbackKey: string): Elem {
    const raw = line.tag ?? '';
    let segs = this.paths.get(raw);
    if (!segs) this.paths.set(raw, (segs = parseTagPath(line.tag)));
    let parent: Elem | null = null;
    let prefix = '';
    for (const [i, seg] of segs.entries()) {
      prefix += `${prefix ? '/' : ''}${seg.tag}`;
      const leaf = i === segs.length - 1;
      const key = seg.key ?? (leaf ? (line.block ?? fallbackKey) : `@${prefix}`);
      let elem = this.elems.get(key);
      if (!elem) {
        elem = this.newElem(seg.tag, parent, key);
        // A new top-level element starts at this line's top.
        if (!parent)
          this.page.blocks.push({ elem, top: Math.max(line.y0, line.y1) + 0.8 * line.size });
      }
      parent = elem;
    }
    return parent!;
  }

  /** Opens a Figure on the current page, its alt texts read when the tree is written (more may join while it is
   *  drawn). `top` is its top edge in PDF points (y up), placing it in reading order. */
  figure(alts: string[], top: number): { open: string; close: string } {
    const elem = this.newElem('Figure', null, null);
    elem.alts = alts;
    this.page.figures.push({ elem, top });
    return this.mcid(elem);
  }

  /** Puts the page's new top-level elements in the Document: its blocks in their order, each figure before the first
   *  block that starts below its top (EX6), the rest after them. */
  endPage(): void {
    const page = this.page;
    const figures = [...page.figures].sort((a, b) => b.top - a.top);
    let f = 0;
    for (const block of page.blocks) {
      while (f < figures.length && figures[f]!.top >= block.top)
        this.order.push(figures[f++]!.elem);
      this.order.push(block.elem);
    }
    while (f < figures.length) this.order.push(figures[f++]!.elem);
  }

  /** Takes back everything the current page added: it is drawn as a picture instead. */
  resetPage(): void {
    const page = this.page;
    for (const key of page.added) this.elems.delete(key);
    for (const [elem, length] of page.touched) elem.kids.length = length;
    page.mcids = [];
    page.blocks = [];
    page.figures = [];
    page.added = [];
    page.touched.clear();
  }

  /** Writes the tree: the root, a Document element over the top-level elements, and the parent tree. */
  write(): void {
    const doc = this.file.alloc();
    const writeElem = (e: Elem) => {
      const kids = e.kids
        .map((k) =>
          'mcid' in k ? `<< /Type /MCR /Pg ${k.page} 0 R /MCID ${k.mcid} >>` : `${k.obj} 0 R`,
        )
        .join(' ');
      const extra =
        e.tag === 'Figure'
          ? ` /Alt ${pdfTextString(e.alts!.join('. '))}`
          : e.tag === 'TH'
            ? ' /A << /O /Table /Scope /Column >>'
            : '';
      this.file.put(
        e.obj,
        `<< /Type /StructElem /S /${e.tag} /P ${e.parent ? e.parent.obj : doc} 0 R${extra} /K [${kids}] >>`,
      );
      for (const k of e.kids) if (!('mcid' in k)) writeElem(k);
    };
    for (const e of this.order) writeElem(e);
    this.file.put(
      doc,
      `<< /Type /StructElem /S /Document /P ${this.root} 0 R /K [${this.order.map((e) => `${e.obj} 0 R`).join(' ')}] >>`,
    );
    const nums = this.pages
      .map((p, i) => `${i} [${p.mcids.map((e) => `${e.obj} 0 R`).join(' ')}]`)
      .join(' ');
    const parents = this.file.put(this.file.alloc(), `<< /Nums [${nums}] >>`);
    this.file.put(
      this.root,
      `<< /Type /StructTreeRoot /K ${doc} 0 R /ParentTree ${parents} 0 R /ParentTreeNextKey ${this.pages.length} >>`,
    );
  }
}
