// Tags (liveworkspace/docs/specs/013-export/vector-pdf.md "Tags"): where the writing knows its headings and paragraphs (an article's), the PDF
// is tagged. Each line of the text layer is marked content of its block's structure element (H1 to H6, P), the
// outlines that draw it and every other drawing are artifacts, and the structure tree lists the blocks in reading
// order, a block running over two pages keeping one element. A PDF with no such writing stays untagged.
import type { PdfFile } from './pdf-file';
import type { TextItem } from './text-layer';

const TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P']);

/** A tag the writer can use, or P. */
export const structTag = (tag: string | undefined): string => (tag && TAGS.has(tag) ? tag : 'P');

type Elem = { obj: number; tag: string; kids: { page: number; mcid: number }[] };

export class StructTree {
  private readonly elems = new Map<string, Elem>();
  private readonly order: Elem[] = [];
  // Per page: its structure parent index, and each MCID's element, in order.
  private readonly pages: { pageObj: number; mcids: Elem[] }[] = [];
  readonly root: number;

  private readonly file: PdfFile;

  constructor(file: PdfFile) {
    this.file = file;
    this.root = file.alloc();
  }

  /** Starts a page's marked content; returns its StructParents index. */
  beginPage(pageObj: number): number {
    this.pages.push({ pageObj, mcids: [] });
    return this.pages.length - 1;
  }

  /** The marked-content operators around one line of the current page's text layer. */
  mark(line: TextItem, fallbackKey: string): { open: string; close: string } {
    const key = line.block ?? fallbackKey;
    let elem = this.elems.get(key);
    if (!elem) {
      elem = { obj: this.file.alloc(), tag: structTag(line.tag), kids: [] };
      this.elems.set(key, elem);
      this.order.push(elem);
    }
    const page = this.pages[this.pages.length - 1]!;
    const mcid = page.mcids.length;
    page.mcids.push(elem);
    elem.kids.push({ page: page.pageObj, mcid });
    return { open: `/${elem.tag} << /MCID ${mcid} >> BDC`, close: 'EMC' };
  }

  /** Writes the tree: the root, a Document element over every block, and the parent tree. */
  write(): void {
    const doc = this.file.alloc();
    for (const e of this.order) {
      const kids = e.kids
        .map((k) => `<< /Type /MCR /Pg ${k.page} 0 R /MCID ${k.mcid} >>`)
        .join(' ');
      this.file.put(e.obj, `<< /Type /StructElem /S /${e.tag} /P ${doc} 0 R /K [${kids}] >>`);
    }
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
