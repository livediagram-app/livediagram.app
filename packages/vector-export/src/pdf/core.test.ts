// The writer's pure parts (liveworkspace/docs/specs/013-export/vector-pdf.md): matrices, transforms, path data, the file
// and its resources, pictures, the text layer, tags, glyph forms, links and page size.
import { describe, expect, it } from 'vitest';
import { readPdf } from '../test-pdf';
import { glyphOps, placeGlyphs } from './glyph-forms';
import {
  apply,
  invert,
  isIdentity,
  lengthScale,
  mapRect,
  matrixOps,
  multiply,
  num,
  scale,
  translate,
} from './matrix';
import { PdfFile, deflate, pdfLiteral, pdfTextString } from './pdf-file';
import { dataUrlBytes, jpegInfo, putJpeg, putPixels } from './pdf-image';
import { linkAnnotation, pdfString } from './pdf-links';
import { MAX_PDF_PAGE_PT, pageMedia, singlePageMedia } from './pdf-page-size';
import { PdfResources } from './pdf-resources';
import { StructTree, structTag } from './struct-tree';
import type { SvgContext } from './svg-context';
import { parsePath, pathToPdf, segmentsToPdf } from './svg-path';
import { rectSegments, segmentBounds, transformSegments } from './svg-shapes';
import { parseTransform, parseViewBox, viewBoxMatrix } from './svg-transform';
import {
  InvisibleFonts,
  lineOps,
  mergeLines,
  readingOrder,
  textLayerOps,
  type TextItem,
} from './text-layer';

const close = (a: readonly number[], b: readonly number[]) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));

describe('matrix', () => {
  it('multiplies, inverts, applies and maps rectangles', () => {
    const m = multiply(translate(10, 20), scale(2, 3));
    expect(m).toEqual([2, 0, 0, 3, 10, 20]);
    expect(apply(m, 1, 1)).toEqual([12, 23]);
    close(multiply(m, invert(m)!), [1, 0, 0, 1, 0, 0]);
    expect(invert([0, 0, 0, 0, 1, 1])).toBeNull();
    expect(lengthScale(scale(4, 9))).toBe(6);
    expect(isIdentity([1, 0, 0, 1, 0, 0])).toBe(true);
    expect(isIdentity(m)).toBe(false);
    expect(mapRect([0, 1, -1, 0, 0, 0], { x: 1, y: 2, w: 3, h: 4 })).toEqual({
      x: -6,
      y: 1,
      w: 4,
      h: 3,
    });
  });

  it('writes numbers short and finite', () => {
    expect(num(1.23456789)).toBe('1.2346');
    expect(num(-0.00001)).toBe('0');
    expect(num(Number.NaN)).toBe('0');
    expect(num(3)).toBe('3');
    expect(num(1e-7 + 2)).toBe('2');
    expect(matrixOps([1, 0, 0, -1, 0.5, 2])).toBe('1 0 0 -1 0.5 2 cm');
  });
});

describe('transforms and viewBoxes', () => {
  it('reads every transform function in order and stops at nonsense', () => {
    expect(parseTransform(null)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(parseTransform('translate(5)')).toEqual([1, 0, 0, 1, 5, 0]);
    expect(parseTransform('translate(5, 6) scale(2)')).toEqual([2, 0, 0, 2, 5, 6]);
    expect(parseTransform('scale(2 3)')).toEqual([2, 0, 0, 3, 0, 0]);
    expect(parseTransform('matrix(1 2 3 4 5 6)')).toEqual([1, 2, 3, 4, 5, 6]);
    close(parseTransform('rotate(90)'), [0, 1, -1, 0, 0, 0]);
    close(parseTransform('rotate(90 10 10)'), [0, 1, -1, 0, 20, 0]);
    close(parseTransform('skewX(45)'), [1, 0, 1, 1, 0, 0]);
    close(parseTransform('skewY(45)'), [1, 1, 0, 1, 0, 0]);
    // An invalid list is ignored whole, as SVG does.
    expect(parseTransform('translate(1) bogus(2) scale(9)')).toEqual([1, 0, 0, 1, 0, 0]);
    expect(parseTransform('matrix(1 2)')).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('fits a viewBox to its port as preserveAspectRatio says', () => {
    const view = { x: 0, y: 0, w: 100, h: 50 };
    const port = { x: 0, y: 0, w: 200, h: 200 };
    expect(viewBoxMatrix(view, port, 'none')).toEqual([2, 0, 0, 4, 0, 0]);
    expect(viewBoxMatrix(view, port, null)).toEqual([2, 0, 0, 2, 0, 50]);
    expect(viewBoxMatrix(view, port, 'xMinYMin')).toEqual([2, 0, 0, 2, 0, 0]);
    expect(viewBoxMatrix(view, port, 'xMaxYMax meet')).toEqual([2, 0, 0, 2, 0, 100]);
    expect(viewBoxMatrix(view, port, 'xMidYMid slice')).toEqual([4, 0, 0, 4, -100, 0]);
    expect(parseViewBox('0 0 10 20')).toEqual({ x: 0, y: 0, w: 10, h: 20 });
    expect(parseViewBox('0,0,-1,2')).toBeNull();
    expect(parseViewBox('1 2 3')).toBeNull();
    expect(parseViewBox(null)).toBeNull();
  });
});

describe('path data', () => {
  it('reads every command, absolute and relative, into lines and cubics', () => {
    const segs = parsePath('M0 0 L10 0 H20 V10 h-5 v5 l-5 0 Z m1 1 l1 1');
    expect(segs.map((s) => s.k).join('')).toBe('MLLLLLLZML');
    expect(segs[2]).toEqual({ k: 'L', x: 20, y: 0 });
    expect(segs[9]).toEqual({ k: 'L', x: 2, y: 2 });
    // A move after a close starts from the subpath's start.
    expect(segs[8]).toEqual({ k: 'M', x: 1, y: 1 });
  });

  it('turns quadratics, smooth curves and arcs into cubics', () => {
    const q = parsePath('M0 0 Q10 10 20 0 T40 0');
    expect(q.map((s) => s.k).join('')).toBe('MCC');
    expect(q[1]).toMatchObject({ x1: 6.666666666666666, y1: 6.666666666666666, x: 20, y: 0 });
    // T reflects the last control point.
    expect(q[2]).toMatchObject({ x: 40, y: 0 });
    expect((q[2] as { y1: number }).y1).toBeLessThan(0);
    const c = parsePath(
      'M0 0 C0 10 10 10 10 0 S20 -10 20 0 s10 10 10 0 c1 1 2 2 3 3 q1 1 2 0 t2 0',
    );
    expect(c.every((s, i) => i === 0 || s.k === 'C')).toBe(true);
    expect(c[2]).toMatchObject({ x1: 10, y1: -10, x: 20, y: 0 });
    const a = parsePath('M0 0 A10 10 0 0 1 20 0 a5 5 0 1 0 10 0');
    expect(a.filter((s) => s.k === 'C').length).toBeGreaterThanOrEqual(3);
    expect(a.at(-1)).toMatchObject({ x: 30, y: 0 });
    // Degenerate arcs: a zero radius is a line, an arc to where it starts draws nothing.
    expect(parsePath('M0 0 A0 5 0 0 1 5 5')[1]).toEqual({ k: 'L', x: 5, y: 5 });
    expect(parsePath('M0 0 A5 5 0 0 1 0 0')).toHaveLength(1);
    // A too-small radius is scaled up to reach.
    const big = parsePath('M0 0 A1 1 0 0 0 10 0');
    expect(big.at(-1)).toMatchObject({ x: 10, y: 0 });
  });

  it('keeps implicit commands, compact numbers and arc flags', () => {
    expect(
      parsePath('M0 0 10 10 20 0')
        .map((s) => s.k)
        .join(''),
    ).toBe('MLL');
    expect(parsePath('m1 1 2 2').at(-1)).toEqual({ k: 'L', x: 3, y: 3 });
    expect(parsePath('M.5.5L1e1-2').at(-1)).toEqual({ k: 'L', x: 10, y: -2 });
    expect(parsePath('M0 0a5 5 0 1110 0').at(-1)).toMatchObject({ x: 10, y: 0 });
  });

  it('stops at the first error, keeping what came before, and needs a move first', () => {
    expect(parsePath('M0 0 L10 10 L oops 5 L 20 20')).toHaveLength(2);
    expect(parsePath('L10 10')).toEqual([]);
    expect(parsePath('')).toEqual([]);
    expect(parsePath('M0 0 X10')).toHaveLength(1);
    expect(parsePath('M0 0 A5 5 0 2 0 1 1')).toHaveLength(1);
  });

  it('writes PDF path operators', () => {
    expect(pathToPdf('M0 0 L1 2 C1 1 2 2 3 3 Z')).toBe('0 0 m\n1 2 l\n1 1 2 2 3 3 c\nh');
    expect(segmentsToPdf([])).toBe('');
  });
});

describe('shapes', () => {
  it('draws rectangles, rounded or square, and bounds segments', () => {
    expect(
      rectSegments(0, 0, 10, 5)
        .map((s) => s.k)
        .join(''),
    ).toBe('MLLLZ');
    const round = rectSegments(0, 0, 10, 10, 2);
    expect(round.filter((s) => s.k === 'C')).toHaveLength(4);
    // Radii clamp to half the side; one radius alone sets both.
    expect(segmentBounds(rectSegments(0, 0, 10, 4, 50, undefined))).toEqual({
      x: 0,
      y: 0,
      w: 10,
      h: 4,
    });
    expect(rectSegments(0, 0, 0, 5)).toEqual([]);
    expect(segmentBounds([{ k: 'Z' }])).toBeNull();
    expect(transformSegments(rectSegments(0, 0, 1, 1), [2, 0, 0, 2, 1, 1])[2]).toEqual({
      k: 'L',
      x: 3,
      y: 3,
    });
    expect(
      transformSegments(
        [{ k: 'C', x1: 1, y1: 1, x2: 2, y2: 2, x: 3, y: 3 }],
        [1, 0, 0, 1, 1, 0],
      )[0],
    ).toEqual({
      k: 'C',
      x1: 2,
      y1: 1,
      x2: 3,
      y2: 2,
      x: 4,
      y: 3,
    });
  });
});

describe('the file', () => {
  it('writes objects in any order, compresses long streams, and points the table at each', async () => {
    const file = new PdfFile();
    const a = file.alloc();
    const b = file.alloc();
    const unused = file.alloc();
    file.putStream(b, '/Type /Test', 'x'.repeat(500));
    const short = file.putStream(file.alloc(), '', 'short');
    const jpeg = file.putStream(
      file.alloc(),
      '/Subtype /Image',
      new Uint8Array([1, 2, 3]),
      'DCTDecode',
    );
    file.put(a, '<< /Type /Catalog >>');
    const info = file.put(file.alloc(), `<< /Title ${pdfTextString('Ünïcode ✓')} >>`);
    const pdf = readPdf(await file.toBytes(a, info));
    expect(pdf.text.startsWith('%PDF-1.7\n')).toBe(true);
    expect(pdf.objects.get(b)!.dict).toContain('/FlateDecode');
    expect(pdf.objects.get(b)!.stream).toBe('x'.repeat(500));
    expect(pdf.objects.get(short)!.dict).not.toContain('/Filter');
    expect(pdf.objects.get(jpeg)!.dict).toContain('/Filter /DCTDecode');
    expect(pdf.objects.get(unused)!.dict).toBe('null');
    expect(pdf.text).toContain(`/Root ${a} 0 R /Info ${info} 0 R`);
    const bare = readPdf(await new PdfFile().toBytes(1));
    expect(bare.text).not.toContain('/Info');
  });

  it('deflates and escapes strings', async () => {
    expect((await deflate(new Uint8Array(100))).length).toBeLessThan(100);
    expect(pdfLiteral('a(b)\\c')).toBe('(a\\(b\\)\\\\c)');
    expect(pdfTextString('Hi')).toBe('<FEFF00480069>');
  });

  it('names resources once and shares graphics states', async () => {
    const file = new PdfFile();
    const res = new PdfResources(file);
    expect(res.state(0.5, 1)).toBe(res.state(0.5, 1));
    expect(res.state(0.5, 1, 'Multiply')).not.toBe(res.state(0.5, 1));
    expect(res.name('XObject', 9)).toBe('X0');
    expect(res.name('XObject', 10)).toBe('X1');
    res.write();
    const pdf = readPdf(await file.toBytes(res.ref));
    expect(pdf.objects.get(res.ref)!.dict).toContain('/XObject << /X0 9 0 R /X1 10 0 R >>');
    expect(pdf.objects.get(res.ref)!.dict).not.toContain('/Font');
  });
});

describe('pictures', () => {
  const px = (rgba: number[]) => ({
    width: rgba.length / 4,
    height: 1,
    data: new Uint8ClampedArray(rgba),
  });

  it('keeps transparency as a soft mask, or lays a page on white', async () => {
    const file = new PdfFile();
    const opaque = putPixels(file, px([255, 0, 0, 255]));
    const clear = putPixels(file, px([255, 0, 0, 0, 0, 0, 255, 255]));
    const page = putPixels(file, px([0, 0, 0, 0, 0, 0, 0, 128]), true);
    const pdf = readPdf(await file.toBytes(1));
    expect(pdf.objects.get(opaque)!.dict).not.toContain('/SMask');
    expect(pdf.objects.get(clear)!.dict).toContain('/SMask');
    expect([...pdf.objects.get(page)!.bytes!]).toEqual([255, 255, 255, 127, 127, 127]);
  });

  it('passes a JPEG through by its frame header', async () => {
    const sof = (marker: number, comps: number) =>
      new Uint8Array([
        0xff,
        0xd8,
        0xff,
        0xff,
        0xe0,
        0,
        4,
        0,
        0,
        0xff,
        marker,
        0,
        11,
        8,
        0,
        20,
        0,
        30,
        comps,
        0,
        0,
        0,
        0,
      ]);
    expect(jpegInfo(sof(0xc0, 3))).toEqual({ width: 30, height: 20, components: 3 });
    expect(jpegInfo(sof(0xc2, 1))).toEqual({ width: 30, height: 20, components: 1 });
    expect(jpegInfo(sof(0xc0, 4))).toBeNull();
    expect(jpegInfo(sof(0xc4, 3))).toBeNull();
    expect(jpegInfo(new Uint8Array([0x89, 0x50]))).toBeNull();
    expect(jpegInfo(new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    const file = new PdfFile();
    expect(putJpeg(file, new Uint8Array([1, 2]))).toBeNull();
    const gray = putJpeg(file, sof(0xc0, 1))!;
    const pdf = readPdf(await file.toBytes(1));
    expect(pdf.objects.get(gray.obj)!.dict).toContain('/DeviceGray');
  });

  it('reads data: URLs', () => {
    expect(dataUrlBytes('data:image/png;base64,AQID')).toEqual({
      type: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(new TextDecoder().decode(dataUrlBytes('data:text/plain,a%20b')!.bytes)).toBe('a b');
    expect(dataUrlBytes('https://x/y.png')).toBeNull();
    expect(dataUrlBytes('data:nocomma')).toBeNull();
  });
});

describe('the text layer', () => {
  const item = (text: string, x0: number, x1: number, extra: Partial<TextItem> = {}): TextItem => ({
    text,
    x0,
    y0: 100,
    x1,
    y1: 100,
    size: 10,
    ...extra,
  });

  it('joins words on one baseline into lines, with a space where the gap is a word gap', () => {
    const lines = mergeLines([
      item('Hello', 0, 30),
      item('world', 33, 60),
      item('!', 60, 63),
      item('far', 200, 220),
      item('next', 0, 20, { y0: 80, y1: 80 }),
      item('other', 21, 40, { y0: 80, y1: 80, block: '2' }),
      item('big', 41, 60, { y0: 80, y1: 80, block: '2', size: 30 }),
    ]);
    expect(lines.map((l) => l.text)).toEqual(['Hello world!', 'far', 'next', 'other', 'big']);
    expect(lines[0]).toMatchObject({ x0: 0, x1: 63 });
    // A turned run joins along its own direction; one going another way starts a new line.
    const up = mergeLines([
      { text: 'a', x0: 0, y0: 0, x1: 0, y1: 10, size: 10 },
      { text: 'b', x0: 0, y0: 12, x1: 0, y1: 20, size: 10 },
      { text: 'c', x0: 0, y0: 20, x1: 10, y1: 20, size: 10 },
      { text: 'd', x0: 10, y0: 20, x1: 10, y1: 20, size: 10 },
    ]);
    expect(up.map((l) => l.text)).toEqual(['a b', 'cd']);
    expect(
      mergeLines([item(' a', 0, 5), item('b ', 5.5, 9), item('c', 11, 12)]).map((l) => l.text),
    ).toEqual([' ab c']);
  });

  it('puts tagged runs in their blocks’ order, keeping the slots of untagged ones', () => {
    const order = readingOrder([
      item('1.', 0, 5, { block: '3' }),
      item('page 1', 0, 5),
      item('2.', 0, 5, { block: '5' }),
      item('first', 0, 5, { block: '3' }),
      item('second', 0, 5, { block: '5' }),
    ]);
    expect(order.map((i) => i.text)).toEqual(['1.', 'page 1', 'first', '2.', 'second']);
    expect(readingOrder([item('one', 0, 1, { block: '1' })]).map((i) => i.text)).toEqual(['one']);
  });

  it('codes characters in Type 3 fonts of 255, mapped back to Unicode', async () => {
    const file = new PdfFile();
    const res = new PdfResources(file);
    const fonts = new InvisibleFonts(file, res);
    new InvisibleFonts(file, res).write();
    const many = Array.from({ length: 300 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('');
    const runs = fonts.encode(`ab${many}a😀`);
    expect(runs.map((r) => r.name)).toEqual(['F0', 'F1', 'F0', 'F1']);
    expect(runs[0]!.hex).toMatch(/^0102/);
    expect(runs[2]!.hex).toBe('01');
    fonts.write();
    res.write();
    const pdf = readPdf(await file.toBytes(res.ref));
    const type3 = pdf.find('/Subtype /Type3');
    expect(type3).toHaveLength(2);
    expect(type3[0]!.dict).toContain('/LastChar 255');
    const cmaps = [...pdf.objects.values()].filter((o) => o.stream?.includes('beginbfchar'));
    expect(cmaps[0]!.stream).toContain('<01> <0061>');
    expect(cmaps[0]!.stream!.match(/beginbfchar/g)).toHaveLength(3);
    expect(cmaps[1]!.stream).toContain('<D83DDE00>');
  });

  it('writes each line invisible, placed, turned and stretched to its width, marked when tagged', () => {
    const file = new PdfFile();
    const fonts = new InvisibleFonts(file, new PdfResources(file));
    expect(lineOps(item('ab', 10, 30), fonts)).toBe(
      '200 Tz\n1 0 0 1 10 100 Tm\n/F0 10 Tf <0102> Tj',
    );
    expect(lineOps({ text: 'a', x0: 0, y0: 0, x1: 0, y1: 5, size: 10 }, fonts)).toContain(
      '0 1 -1 0 0 0 Tm',
    );
    expect(lineOps(item('a', 5, 5), fonts)).toContain('100 Tz');
    expect(lineOps(item('', 0, 5), fonts)).toBe('');
    expect(lineOps(item('a', 0, 5, { size: 0 }), fonts)).toBe('');
    const ops = textLayerOps([item('a', 0, 5), item('', 0, 0), item('b', 0, 5)], fonts, (_l, i) =>
      i === 0 ? { open: '/P << /MCID 0 >> BDC', close: 'EMC' } : (undefined as never),
    );
    expect(ops.split('\n')).toEqual([
      '/P << /MCID 0 >> BDC',
      'BT',
      '3 Tr',
      '100 Tz',
      '1 0 0 1 0 100 Tm',
      '/F0 10 Tf <01> Tj',
      'ET',
      'EMC',
      'BT',
      '3 Tr',
      '100 Tz',
      '1 0 0 1 0 100 Tm',
      '/F0 10 Tf <02> Tj',
      'ET',
    ]);
  });
});

describe('tags', () => {
  it('keeps one element per block across pages, in reading order, with a parent tree', async () => {
    const file = new PdfFile();
    const tree = new StructTree(file);
    const p1 = file.alloc();
    const p2 = file.alloc();
    expect(tree.beginPage(p1)).toBe(0);
    const line = (block: string | undefined, tag?: string): TextItem => ({
      text: 'x',
      x0: 0,
      y0: 0,
      x1: 1,
      y1: 0,
      size: 1,
      ...(block ? { block } : {}),
      ...(tag ? { tag } : {}),
    });
    expect(tree.mark(line('1', 'H1'), 'a')).toEqual({
      open: '/H1 << /MCID 0 >> BDC',
      close: 'EMC',
    });
    expect(tree.mark(line('2', 'BLOCKQUOTE'), 'b').open).toBe('/P << /MCID 1 >> BDC');
    expect(tree.beginPage(p2)).toBe(1);
    expect(tree.mark(line('2'), 'c').open).toBe('/P << /MCID 0 >> BDC');
    expect(tree.mark(line(undefined), 'p1-0').open).toBe('/P << /MCID 1 >> BDC');
    tree.write();
    const pdf = readPdf(await file.toBytes(tree.root));
    const elems = pdf.find('/Type /StructElem');
    expect(elems.filter((e) => e.dict.includes('/S /P'))).toHaveLength(2);
    const two = elems.find((e) => e.dict.includes(`/Pg ${p2} 0 R /MCID 0`))!;
    expect(two.dict).toContain(`/Pg ${p1} 0 R /MCID 1`);
    expect(pdf.find('/Nums [0 [')[0]!.dict).toMatch(
      /\/Nums \[0 \[\d+ 0 R \d+ 0 R\] 1 \[\d+ 0 R \d+ 0 R\]\]/,
    );
    expect(structTag(undefined)).toBe('P');
    expect(structTag('H3')).toBe('H3');
  });
});

describe('glyph forms', () => {
  it('writes a glyph outline in font units, raising quadratics, with its box', () => {
    const { ops, bbox } = glyphOps([
      { command: 'moveTo', args: [0, 0] },
      { command: 'lineTo', args: [300, 0] },
      { command: 'quadraticCurveTo', args: [300, 300, 0, 300] },
      { command: 'bezierCurveTo', args: [0, 200, 0, 100, 0, 0] },
      { command: 'closePath', args: [] },
    ]);
    expect(ops).toBe('0 0 m\n300 0 l\n300 200 200 300 0 300 c\n0 200 0 100 0 0 c\nh');
    expect(bbox).toEqual([0, 0, 300, 300]);
    expect(glyphOps([])).toEqual({ ops: '', bbox: [0, 0, 0, 0] });
  });

  it('writes each glyph of a face once and places it wherever it is used', async () => {
    const file = new PdfFile();
    const res = new PdfResources(file);
    const ctx = { file, res, glyphs: new Map() } as unknown as SvgContext;
    const glyph = (id: number, e: number) => ({
      id,
      commands: [
        { command: 'moveTo', args: [0, 0] },
        { command: 'lineTo', args: [1, 1] },
      ],
      matrix: [0.01, 0, 0, -0.01, e, 5] as const,
    });
    const ops = placeGlyphs(ctx, 'inter|400|16', [glyph(3, 0), glyph(4, 7), glyph(3, 14)]);
    expect(ops.split('\n')).toEqual([
      'q 0.01 0 0 -0.01 0 5 cm /X0 Do Q',
      'q 0.01 0 0 -0.01 7 5 cm /X1 Do Q',
      'q 0.01 0 0 -0.01 14 5 cm /X0 Do Q',
    ]);
    placeGlyphs(ctx, 'inter|700|16', [glyph(3, 0)]);
    expect(ctx.glyphs.size).toBe(3);
    const pdf = readPdf(await file.toBytes(1));
    const forms = pdf.find('/Subtype /Form');
    expect(forms).toHaveLength(3);
    expect(forms[0]!.dict).toContain('/BBox [0 0 1 1]');
    expect(forms[0]!.stream).toBe('0 0 m\n1 1 l\nf');
  });
});

describe('links and page size', () => {
  it('writes link annotations to a page or an address', () => {
    expect(linkAnnotation({ x: 1, y: 2, w: 3, h: 4, page: 1 }, (i) => `${i + 10} 0 R`)).toBe(
      '<< /Type /Annot /Subtype /Link /Rect [1 2 4 6] /Border [0 0 0] /Dest [11 0 R /Fit] >>',
    );
    expect(linkAnnotation({ x: 0, y: 0, w: 1, h: 1, uri: 'https://a.b/(x)' }, () => '')).toContain(
      '/A << /S /URI /URI (https://a.b/\\(x\\)) >>',
    );
    expect(pdfString('a\\b')).toBe('(a\\\\b)');
  });

  it('sizes a page in points, fitted under the PDF limit', () => {
    expect(pageMedia(800, 600)).toEqual({ mediaW: 600, mediaH: 450 });
    const huge = pageMedia(40000, 10000);
    expect(huge.mediaW).toBe(MAX_PDF_PAGE_PT);
    expect(huge.mediaH).toBe(MAX_PDF_PAGE_PT / 4);
    expect(singlePageMedia(1600, 1200, 2)).toEqual({ mediaW: 600, mediaH: 450 });
  });
});
