// The structure tree (liveworkspace/docs/specs/013-export/vector-pdf.md "Tags"): tag paths into lists and tables,
// figures in reading order, a page taken back, read back as a reader's tag pane would show it (structDump).
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { readPdf, structDump } from '../test-pdf';
import { PdfFile } from './pdf-file';
import { StructTree, parseTagPath } from './struct-tree';
import type { TextItem } from './text-layer';

// A line of the text layer: `y` its baseline, in PDF points (y up).
const line = (tag: string | undefined, block: number | undefined, y = 0): TextItem => ({
  text: 'x',
  x0: 0,
  y0: y,
  x1: 10,
  y1: y,
  size: 10,
  ...(tag !== undefined ? { tag } : {}),
  ...(block !== undefined ? { block: String(block) } : {}),
});

async function dump(file: PdfFile, tree: StructTree, pages: number[]): Promise<string> {
  tree.write();
  const catalog = file.alloc();
  const pagesObj = file.alloc();
  for (const p of pages) file.put(p, `<< /Type /Page /Parent ${pagesObj} 0 R >>`);
  file.put(
    pagesObj,
    `<< /Type /Pages /Kids [${pages.map((p) => `${p} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  );
  file.put(catalog, `<< /Type /Catalog /Pages ${pagesObj} 0 R /StructTreeRoot ${tree.root} 0 R >>`);
  return structDump(readPdf(await file.toBytes(catalog)));
}

describe('tag paths', () => {
  it('reads segments outermost first, keyed or not; an unknown leaf is P and an unknown container left out', () => {
    expect(parseTagPath('L#l0/LI#i4/LBody')).toEqual([
      { tag: 'L', key: 'l0' },
      { tag: 'LI', key: 'i4' },
      { tag: 'LBody', key: null },
    ]);
    expect(parseTagPath('Div#d/TR#/Span')).toEqual([
      { tag: 'TR', key: null },
      { tag: 'P', key: null },
    ]);
    expect(parseTagPath(undefined)).toEqual([{ tag: 'P', key: null }]);
    expect(parseTagPath('H2')).toEqual([{ tag: 'H2', key: null }]);
  });
});

describe('the structure tree', () => {
  it('nests lists in their items’ bodies and tables in rows, one element per block across pages', async () => {
    const file = new PdfFile();
    const tree = new StructTree(file);
    const p1 = file.alloc();
    const p2 = file.alloc();
    tree.beginPage(p1);
    const marks = [
      line('H1', 0, 800),
      line('L#l0/LI#i1/Lbl#m1', 1, 780),
      line('L#l0/LI#i1/LBody', 1, 780),
      line('L#l0/LI#i1/LBody#1/L#l1/LI#i2/Lbl#m2', 2, 760),
      line('L#l0/LI#i1/LBody#1/L#l1/LI#i2/LBody', 2, 760),
      line('L#l0/LI#i3/LBody', 3, 740),
      line('BlockQuote', 4, 720),
      line('Table#t0/TR#r0/TH', 5, 700),
      line('Table#t0/TR#r0/TH', 6, 700),
      line('Table#t0/TR#r1/TD', 7, 680),
    ].map((l) => tree.mark(l, 'unused').open);
    expect(marks[1]).toBe('/Lbl << /MCID 1 >> BDC');
    expect(marks[7]).toBe('/TH << /MCID 7 >> BDC');
    tree.endPage();
    tree.beginPage(p2);
    // The table and its last cell carry on; a new row starts.
    tree.mark(line('Table#t0/TR#r1/TD', 7, 800), 'unused');
    tree.mark(line('Table#t0/TR#r2/TD', 8, 780), 'unused');
    tree.mark(line(undefined, undefined, 760), 'p1-2');
    tree.endPage();
    expect(await dump(file, tree, [p1, p2])).toBe(
      [
        'Document',
        '  H1 [0:0]',
        '  L',
        '    LI',
        '      Lbl [0:1]',
        '      LBody [0:2]',
        '        L',
        '          LI',
        '            Lbl [0:3]',
        '            LBody [0:4]',
        '    LI',
        '      LBody [0:5]',
        '  BlockQuote [0:6]',
        '  Table',
        '    TR',
        '      TH Column [0:7]',
        '      TH Column [0:8]',
        '    TR',
        '      TD [0:9 1:0]',
        '    TR',
        '      TD [1:1]',
        '  P [1:2]',
      ].join('\n'),
    );
  });

  it('shares a container a path names without a key', async () => {
    const file = new PdfFile();
    const tree = new StructTree(file);
    const p1 = file.alloc();
    tree.beginPage(p1);
    tree.mark(line('L/LI#a/LBody', 0), 'unused');
    tree.mark(line('L/LI#b/LBody', 1), 'unused');
    tree.endPage();
    expect(await dump(file, tree, [p1])).toBe(
      ['Document', '  L', '    LI', '      LBody [0:0]', '    LI', '      LBody [0:1]'].join('\n'),
    );
  });

  it('puts each figure before the first new block below its top, joining alt texts added while drawn', async () => {
    const file = new PdfFile();
    const tree = new StructTree(file);
    const p1 = file.alloc();
    const p2 = file.alloc();
    tree.beginPage(p1);
    tree.mark(line('P', 0, 700), 'unused');
    tree.endPage();
    tree.beginPage(p2);
    const alts = ['A chart'];
    // Drawn before the text layer: their MCIDs come first.
    expect(tree.figure(alts, 790).open).toBe('/Figure << /MCID 0 >> BDC');
    alts.push('its legend');
    tree.figure(['Footer art'], Number.NEGATIVE_INFINITY);
    tree.figure(['A photo'], 760);
    // The paragraph carries on (not new on this page), then a heading and a paragraph.
    tree.mark(line('P', 0, 790), 'unused');
    tree.mark(line('H2', 1, 770), 'unused');
    tree.mark(line('P', 2, 700), 'unused');
    tree.endPage();
    expect(await dump(file, tree, [p1, p2])).toBe(
      [
        'Document',
        '  P [0:0 1:3]',
        '  Figure "A chart. its legend" [1:0]',
        '  H2 [1:4]',
        '  Figure "A photo" [1:2]',
        '  P [1:5]',
        '  Figure "Footer art" [1:1]',
      ].join('\n'),
    );
  });

  it('takes back what a page drawn as a picture had added', async () => {
    const file = new PdfFile();
    const tree = new StructTree(file);
    const p1 = file.alloc();
    const p2 = file.alloc();
    tree.beginPage(p1);
    tree.mark(line('L#l0/LI#i0/LBody', 0, 700), 'unused');
    tree.endPage();
    tree.beginPage(p2);
    tree.figure(['Lost'], 800);
    tree.mark(line('L#l0/LI#i0/LBody', 0, 790), 'unused');
    tree.mark(line('L#l0/LI#i1/LBody', 1, 770), 'unused');
    tree.mark(line('H1', 2, 750), 'unused');
    tree.resetPage();
    tree.endPage();
    expect(await dump(file, tree, [p1, p2])).toBe(
      ['Document', '  L', '    LI', '      LBody [0:0]'].join('\n'),
    );
  });

  it('stays linear in lines and figures', () => {
    const run = (n: number) => {
      const file = new PdfFile();
      const tree = new StructTree(file);
      for (let p = 0; p < n / 100; p++) {
        tree.beginPage(file.alloc());
        for (let f = 0; f < 10; f++) tree.figure([`Picture ${f}`], 800 - f * 70);
        for (let i = 0; i < 100; i++) {
          const b = p * 100 + i;
          const kind = b % 4;
          const tag =
            kind === 0
              ? 'P'
              : kind === 1
                ? `L#l${p}/LI#i${b}/LBody`
                : kind === 2
                  ? `Table#t${p}/TR#r${b >> 2}/TD`
                  : 'H2';
          tree.mark(line(tag, b, 800 - i * 7), `p${p}-${i}`);
        }
        tree.endPage();
      }
      tree.write();
    };
    run(2_000);
    // 20,000 tagged lines and 2,000 figures over 200 pages.
    expect(cpuMsOf(() => run(20_000))).toBeLessThan(cpuBudgetMs(400));
  });
});
