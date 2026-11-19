// @vitest-environment jsdom
// SVG pages into a PDF (liveworkspace/docs/specs/013-export/vector-pdf.md): what each kind of SVG becomes, read back
// from the file. jsdom lays nothing out, so the browser's layout, canvas, pictures and fonts are stood in for
// (test-dom.ts); the real drawing is checked in a browser, rendered by pdf.js (the PR's screenshots).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FACE_DATA, faceCss, fakeFontkit, installDom, type Dom } from '../test-dom';
import { readPdf, structDump, type ReadPdf } from '../test-pdf';
import { svgPagesToPdf, type SvgPdfPage } from './svg-to-pdf';

let dom: Dom;
beforeEach(() => {
  dom = installDom();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const svg = (body: string, attrs = 'width="200" height="100" viewBox="0 0 200 100"', css = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${
    css ? `<defs><style type="text/css">${css}</style></defs>` : ''
  }${body}</svg>`;

async function write(
  pages: SvgPdfPage[] | string,
  opts: Parameters<typeof svgPagesToPdf>[1] = {},
): Promise<ReadPdf> {
  const list = typeof pages === 'string' ? [{ svg: pages }] : pages;
  const blob = await svgPagesToPdf(list, {
    loadFontkit: async () => fakeFontkit(),
    ...opts,
  });
  expect(blob.type).toBe('application/pdf');
  return readPdf(new Uint8Array(await blob.arrayBuffer()));
}

/** Every content stream of the file, pages, forms and patterns, joined. */
const drawing = (pdf: ReadPdf) =>
  [...pdf.objects.values()]
    .filter((o) => o.stream !== null && !o.dict.includes('/Subtype /Image'))
    .map((o) => o.stream)
    .join('\n');
// The pictures, not their soft masks.
const images = (pdf: ReadPdf) =>
  pdf
    .find('/Subtype /Image')
    .filter((o) => o.dict.includes('/DCTDecode') || !o.dict.includes('/ColorSpace /DeviceGray'));

describe('the page', () => {
  it('is the SVG’s size in points, flipped into PDF space, with its title and language', async () => {
    document.documentElement.lang = 'en-GB';
    const pdf = await write(svg('<rect x="10" y="10" width="20" height="20" fill="#ff0000"/>'), {
      title: 'Plan',
    });
    expect(pdf.find('/Type /Page ')[0]!.dict).toContain('/MediaBox [0 0 150 75]');
    const d = drawing(pdf);
    expect(d).toContain('0.75 0 0 -0.75 0 75 cm');
    expect(d).toContain('1 0 0 rg');
    expect(d).toContain('10 10 m');
    expect(pdf.text).toContain('/Title <FEFF0050006C0061006E>');
    expect(pdf.text).toContain('/Lang <FEFF0065006E002D00470042>');
    // No writing is tagged: the PDF is not marked.
    expect(pdf.text).not.toContain('/StructTreeRoot');
    document.documentElement.lang = '';
  });

  it('takes its size from the viewBox, or the defaults, when width and height are missing', async () => {
    const a = await write(svg('', 'viewBox="5 5 40 20"'));
    expect(a.find('/Type /Page ')[0]!.dict).toContain('/MediaBox [0 0 30 15]');
    const b = await write(svg('', ''));
    expect(b.find('/Type /Page ')[0]!.dict).toContain('/MediaBox [0 0 225 112.5]');
  });

  it('reads markup XML refuses as the browser shows it, the first of a repeated attribute kept', async () => {
    const pdf = await write(
      svg('<path d="M0 0L5 5" fill="none" stroke="#000" stroke-width="3" stroke-width="1"/>'),
    );
    expect(pdf.find('/Type /Page ')[0]!.dict).toContain('/MediaBox [0 0 150 75]');
    const d = drawing(pdf);
    expect(d).toContain('3 w');
    expect(d).not.toContain('\n1 w');
  });

  it('puts link areas on their pages, to a page or an address', async () => {
    const pdf = await write([
      { svg: svg(''), links: [{ x: 1, y: 2, w: 3, h: 4, page: 1 }] },
      { svg: svg(''), links: [{ x: 0, y: 0, w: 1, h: 1, uri: 'https://example.com' }] },
    ]);
    const pages = pdf.find('/Type /Page ');
    expect(pages).toHaveLength(2);
    expect(pdf.find('/Subtype /Link')[0]!.dict).toContain(`/Dest [${pages[1]!.n} 0 R /Fit]`);
    expect(pdf.find('/Subtype /Link')[1]!.dict).toContain('/URI (https://example.com)');
    expect(pages[0]!.dict).toMatch(/\/Annots \[\d+ 0 R\]/);
  });

  // A page whose drawing fails: its text's faces can't be read.
  const failing = svg('<text font-family="Body">x</text>', undefined, faceCss('Body'));
  const broken = async () => {
    throw new Error('no fontkit');
  };

  it('draws a page it can’t draw with its canvas fallback, on white, marked as an artifact when tagged', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const pdf = await write(
      [
        { svg: failing, raster: async () => canvas },
        {
          svg: svg('<text data-pdf-tag="P" data-pdf-block="0">y</text>'),
          raster: async () => canvas,
        },
      ],
      { loadFontkit: broken },
    );
    expect(drawing(pdf)).toContain('q 150 0 0 75 0 0 cm /X0 Do Q');
    expect(drawing(pdf)).toContain('/Artifact BMC\nq 150 0 0 75 0 0 cm');
    expect(images(pdf).length).toBeGreaterThanOrEqual(1);
    // Without a fallback, the failure is the caller's; a page that isn't an SVG always is.
    await expect(write(failing, { loadFontkit: broken })).rejects.toThrow('no fontkit');
    await expect(write('<html/>')).rejects.toThrow('not an SVG');
  });

  it('fails a canvas with no 2d context', async () => {
    const canvas = { width: 1, height: 1, getContext: () => null } as unknown as HTMLCanvasElement;
    await expect(
      write([{ svg: failing, raster: async () => canvas }], { loadFontkit: broken }),
    ).rejects.toThrow('no 2d context');
  });
});

describe('shapes and paint', () => {
  it('fills and strokes every shape, with its line style and paint order', async () => {
    const pdf = await write(
      svg(`
      <rect x="0" y="0" width="10" height="10" rx="2" fill="blue" stroke="rgb(0, 128, 0)" stroke-width="2"
        stroke-dasharray="2,1" stroke-dashoffset="1" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="8"/>
      <circle cx="20" cy="20" r="5" fill="none" stroke="#000"/>
      <ellipse cx="30" cy="30" rx="5" ry="3" fill="#abc" fill-opacity="0.5"/>
      <line x1="0" y1="0" x2="10" y2="10" stroke="black" stroke-linecap="square"/>
      <polyline points="0,0 5,5 10,0" fill="none" stroke="black" stroke-linejoin="round"/>
      <polygon points="0,0 5,5 10,0" fill="black" fill-rule="evenodd" stroke="red" paint-order="stroke"/>
      <path d="M0 0 L5 5" fill="none" stroke="none"/>
      <path d="" fill="black"/>
      <rect width="5" height="5" fill="transparent"/>
      <rect width="5" height="5" fill="#000" fill-opacity="0"/>
      <circle r="0" fill="black"/>
      <unknown/>
      <rect width="5" height="5" fill="#000" display="none"/>
      <rect width="5" height="5" fill="#000" opacity="0"/>
      <title>Ignored</title>`),
    );
    const d = drawing(pdf);
    expect(d).toContain('0 0 1 rg');
    expect(d).toContain('0 0.502 0 RG');
    expect(d).toContain('2 w');
    expect(d).toContain('[2 1] 1 d');
    expect(d).toContain('1 J 2 j 8 M');
    expect(d).toMatch(/\nB\n/);
    expect(d).toContain('2 J');
    expect(d).toContain('1 j');
    // Stroke first, then fill even-odd.
    expect(d).toMatch(/S\n[^]*f\*/);
    expect(pdf.find('/Type /ExtGState').some((g) => g.dict.includes('/ca 0.5'))).toBe(true);
  });

  it('makes a translucent group a transparency group, and a blend mode its graphics state', async () => {
    const pdf = await write(
      svg(`<g opacity="0.5" transform="translate(5 5)"><rect width="10" height="10" fill="red"/></g>
      <g style="mix-blend-mode: multiply"><rect width="10" height="10" fill="red"/></g>
      <rect width="10" height="10" fill="red" stroke="blue" opacity="0.4"/>
      <rect width="10" height="10" fill="red" opacity="0.3" style="mix-blend-mode: screen"/>
      <rect width="10" height="10" fill="red" opacity="nonsense"/>`),
    );
    const forms = pdf.find('/Subtype /Form');
    expect(forms.length).toBe(3);
    expect(forms[0]!.dict).toContain('/Group << /S /Transparency');
    const states = pdf.find('/Type /ExtGState').map((g) => g.dict);
    expect(states.some((s) => s.includes('/BM /Multiply'))).toBe(true);
    expect(states.some((s) => s.includes('/ca 0.3') && s.includes('/BM /Screen'))).toBe(true);
    expect(states.some((s) => s.includes('/ca 0.4'))).toBe(true);
    expect(drawing(pdf)).toContain('1 0 0 1 5 5 cm');
  });

  it('fills with gradients as shading patterns, and a missing paint server with its fallback colour', async () => {
    const pdf = await write(
      svg(`<defs>
        <linearGradient id="lin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient>
        <linearGradient id="three" gradientUnits="userSpaceOnUse" x1="0" x2="100" gradientTransform="rotate(10)">
          <stop offset="0.2" stop-color="red"/><stop offset="0.5" stop-color="lime"/><stop offset="0.9" stop-color="blue"/></linearGradient>
        <radialGradient id="rad" cx="0.5" cy="0.5" r="0.5" fx="0.4" fy="0.4"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
        <radialGradient id="inherits" href="#rad" r="0.3"/>
        <linearGradient id="one"><stop offset="0" stop-color="green"/></linearGradient>
        <linearGradient id="none"/>
      </defs>
      <rect width="50" height="20" fill="url(#lin)"/>
      <rect width="50" height="20" fill="url(#three)" stroke="url(#lin)"/>
      <rect width="50" height="20" fill="url(#rad)"/>
      <rect width="50" height="20" fill="url(#inherits)"/>
      <rect width="50" height="20" fill="url(#one)"/>
      <rect width="50" height="20" fill="url(#none)"/>
      <rect width="50" height="20" fill="url(#missing) #00ff00"/>
      <rect width="50" height="20" fill="url(#missing)"/>
      <rect width="50" height="20" data-no-bbox="1" fill="url(#lin)"/>`),
    );
    const patterns = pdf.find('/PatternType 2');
    // lin as a fill, a stroke and on a shape with no box; three; rad; inherits.
    expect(patterns.length).toBe(6);
    expect(pdf.find('/ShadingType 2').length).toBeGreaterThan(0);
    expect(pdf.find('/ShadingType 3').length).toBe(2);
    expect(pdf.find('/FunctionType 3').length).toBeGreaterThan(0);
    const d = drawing(pdf);
    expect(d).toContain('/Pattern cs /P0 scn');
    expect(d).toContain('/Pattern CS');
    expect(d).toContain('0 1 0 rg');
    // A one-stop gradient is its colour.
    expect(d).toContain('0 0.502 0 rg');
  });

  it('draws a user-space pattern’s tile as vectors, and falls back for what PDF can’t pattern', async () => {
    const pdf = await write(
      svg(`<defs>
        <pattern id="dots" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="scale(2)"><circle cx="5" cy="5" r="2" fill="red"/></pattern>
        <pattern id="box" width="0.5" height="0.5"><rect width="2" height="2"/></pattern>
        <pattern id="vb" patternUnits="userSpaceOnUse" width="4" height="4" viewBox="0 0 1 1"><rect width="1" height="1"/></pattern>
        <pattern id="cu" patternUnits="userSpaceOnUse" patternContentUnits="objectBoundingBox" width="4" height="4"><rect width="1" height="1"/></pattern>
        <pattern id="empty" patternUnits="userSpaceOnUse" width="0" height="4"/>
        <linearGradient id="refl" spreadMethod="reflect"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient>
        <linearGradient id="clear"><stop offset="0" stop-color="red" stop-opacity="0.5"/><stop offset="1" stop-color="blue"/></linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="2"/></filter>
        <marker id="m"><path d="M0 0 L1 1"/></marker>
        <clipPath id="clip-text"><text>no</text></clipPath>
        <symbol id="sym"><rect width="1" height="1"/></symbol>
      </defs>
      <rect width="50" height="20" fill="url(#dots)"/>
      <rect width="50" height="20" fill="url(#empty)"/>
      <rect width="50" height="20" fill="url(#box)"/>
      <rect width="50" height="20" fill="url(#vb)"/>
      <rect width="50" height="20" fill="url(#cu)"/>
      <rect width="50" height="20" fill="url(#refl)"/>
      <rect width="50" height="20" stroke="url(#clear)"/>
      <rect width="50" height="20" fill="red" filter="url(#blur)"/>
      <path d="M0 0 L10 10" stroke="black" marker-end="url(#m)"/>
      <rect width="50" height="20" fill="red" clip-path="url(#clip-text)"/>
      <use href="#sym"/>
      <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject>
      <rect width="50" height="20" fill="red" style="mix-blend-mode: plus-lighter"/>
      <g visibility="hidden"><rect width="5" height="5" fill="red" filter="url(#blur)"/></g>`),
    );
    expect(pdf.find('/PatternType 1')).toHaveLength(1);
    expect(pdf.find('/PatternType 1')[0]!.dict).toContain('/XStep 10 /YStep 10');
    // Box units, a viewBox, box content units, a reflected spread, a translucent stop, a filter, a marker, a clip of
    // text, a use, a foreignObject and an unknown blend: each a picture. The hidden filtered rect draws nothing.
    expect(images(pdf)).toHaveLength(11);
    expect(dom.drawn.filter((s) => s.startsWith('data:image/svg+xml')).length).toBe(11);
  });

  it('clips by clip paths, nested viewports and knockout masks, and pictures soft masks', async () => {
    const pdf = await write(
      svg(`<defs>
        <clipPath id="c" transform="translate(1 1)"><rect width="10" height="10" transform="scale(2)"/><circle r="3" clip-rule="evenodd"/><desc>x</desc><rect width="1" height="1" display="none"/></clipPath>
        <clipPath id="box" clipPathUnits="objectBoundingBox"><rect width="0.5" height="0.5"/></clipPath>
        <clipPath id="nested" clip-path="url(#c)"><rect width="1" height="1"/></clipPath>
        <clipPath id="emptyclip"/>
        <mask id="ko" maskUnits="userSpaceOnUse" x="-100" y="-100" width="400" height="400">
          <rect x="-100" y="-100" width="400" height="400" fill="white"/><rect x="5" y="5" width="10" height="5" fill="black"/><rect x="40" y="5" width="10" height="5" fill="#000"/></mask>
        <mask id="soft"><rect width="10" height="10" fill="#888"/></mask>
        <mask id="overlap" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="white"/><rect width="10" height="10" fill="black"/><rect x="5" width="10" height="10" fill="black"/></mask>
        <mask id="outside" maskUnits="userSpaceOnUse" x="0" y="0" width="10" height="10"><rect width="100" height="100" fill="white"/></mask>
        <mask id="boxunits" maskUnits="userSpaceOnUse" maskContentUnits="objectBoundingBox" x="0" y="0" width="10" height="10"><rect width="1" height="1" fill="white"/></mask>
        <mask id="noregion" maskUnits="userSpaceOnUse"><rect width="1" height="1" fill="white"/></mask>
        <mask id="blackfirst" maskUnits="userSpaceOnUse" x="0" y="0" width="10" height="10"><rect width="1" height="1" fill="black"/></mask>
        <mask id="holeout" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="10" height="10" fill="white"/><rect x="50" width="10" height="10" fill="black"/></mask>
        <mask id="stroked" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="10" height="10" fill="white" stroke="black"/></mask>
        <mask id="textmask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><text>no</text></mask>
        <mask id="emptymask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"/>
      </defs>
      <rect width="50" height="20" fill="red" clip-path="url(#c)"/>
      <rect width="50" height="20" fill="red" clip-path="url(#box)"/>
      <rect width="50" height="20" fill="red" data-no-bbox="1" clip-path="url(#box)"/>
      <rect width="50" height="20" fill="red" clip-path="url(#nested)"/>
      <rect width="50" height="20" fill="red" clip-path="url(#emptyclip)"/>
      <rect width="50" height="20" fill="red" clip-path="url(#ko)"/>
      <path d="M0 10 L100 10" stroke="black" mask="url(#ko)"/>
      <rect width="50" height="20" fill="red" mask="url(#soft)"/>
      <rect width="50" height="20" fill="red" mask="url(#overlap)"/>
      <rect width="50" height="20" fill="red" mask="url(#outside)"/>
      <rect width="50" height="20" fill="red" mask="url(#boxunits)"/>
      <rect width="50" height="20" fill="red" mask="url(#noregion)"/>
      <rect width="50" height="20" fill="red" mask="url(#blackfirst)"/>
      <rect width="50" height="20" fill="red" mask="url(#holeout)"/>
      <rect width="50" height="20" fill="red" mask="url(#stroked)"/>
      <rect width="50" height="20" fill="red" mask="url(#textmask)"/>
      <rect width="50" height="20" fill="red" mask="url(#emptymask)"/>
      <rect width="50" height="20" fill="red" mask="url(#nomask)"/>
      <svg x="10" y="10" width="20" height="20" viewBox="0 0 10 10" overflow="hidden"><rect width="50" height="50" fill="blue"/></svg>
      <svg x="10" y="10" width="20" height="20" overflow="visible"><rect width="50" height="50" fill="blue"/></svg>`),
    );
    const d = drawing(pdf);
    expect(d).toContain('W* n');
    expect(d).toContain('0 0 m h\nW n');
    expect(d).toContain('0 0 10 10 re W n');
    // The knockout's two holes are cut out of its white.
    expect(d).toMatch(/-100 -100 m[^]*5 5 m[^]*40 5 m[^]*W\* n/);
    // soft, overlap, outside, box units, no region, black first, a hole outside, stroked, text, empty, missing, and the
    // clips by a clip and by a bounding box with no box.
    expect(images(pdf).length).toBe(13);
  });
});

describe('pictures', () => {
  it('passes JPEGs through, draws other pictures as pixels, shares repeats and fits them to their box', async () => {
    const jpeg = btoa(
      String.fromCharCode(0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 2, 0, 4, 3, 0, 0, 0, 0, 0, 0, 0),
    );
    const pdf = await write(
      svg(`<image href="data:image/jpeg;base64,${jpeg}" x="0" y="0" width="40" height="20"/>
      <image href="data:image/jpeg;base64,${jpeg}" x="50" y="0" width="40" height="20" preserveAspectRatio="none" opacity="0.5"/>
      <image href="data:image/png;base64,AAAA" width="40" height="20" preserveAspectRatio="xMidYMid slice"/>
      <image xlink:href="data:image/png;base64,AAAA" width="40" height="20"/>
      <image href="https://example.com/a.png" width="4" height="4"/>
      <image href="data:image/jpeg;base64,AAAA" width="4" height="4"/>
      <image href="data:image/png;base64,broken" width="4" height="4"/>
      <image width="4" height="4"/>
      <image href="data:image/png;base64,AAAA" width="0" height="4"/>
      <image href="data:image/png;base64,AAAA" width="4" height="4" visibility="hidden"/>`),
    );
    const imgs = images(pdf);
    expect(imgs.filter((i) => i.dict.includes('/DCTDecode'))).toHaveLength(1);
    expect(imgs.length).toBe(4);
    const d = drawing(pdf);
    expect(d.match(/\/X0 Do/g)).toHaveLength(2);
    expect(d).toContain('re W n');
  });
});

describe('text', () => {
  const css = `${faceCss('Body')}${faceCss('Inter')}`;

  it('draws letters from the embedded faces, each glyph once, under an invisible, tagged text layer', async () => {
    const pdf = await write(
      svg(
        `<text x="10" y="20" font-family="Body" font-size="10" data-pdf-tag="H1" data-pdf-block="0">Title</text>
         <text x="10" y="40" font-family="Body" font-size="10" fill="#333" data-pdf-tag="P" data-pdf-block="1">Hello</text>
         <text x="58" y="40" font-family="Body" font-size="10" data-pdf-tag="P" data-pdf-block="1">there</text>
         <text x="10" y="60" font-family="Body" font-size="10" stroke="red">Outlined</text>
         <text x="10" y="70" font-family="Body" font-size="10" fill="url(#g)">Grad</text>
         <text x="10" y="80" font-family="Body" font-size="10" visibility="hidden">Zzz</text>
         <text x="10" y="90" font-family="Body" font-size="10" opacity="0.5" text-decoration="underline">Half</text>
         <defs><linearGradient id="g"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs>`,
        'width="200" height="100" viewBox="0 0 200 100"',
        css,
      ),
    );
    const d = drawing(pdf);
    // The glyph forms: one per letter of the plain text, placed by matrix.
    const forms = pdf.find('/Subtype /Form').filter((f) => f.dict.includes('/BBox [0 0 500 700]'));
    expect(forms.length).toBe(new Set('TitleHlothrHalf').size);
    expect(d).toMatch(/q 0.01 0 0 -0.01 10 20 cm \/X\d+ Do Q/);
    // Stroked and gradient text keep their paths.
    expect(d).toContain('1 0 0 RG');
    expect(d).toContain('/Pattern cs');
    // The text layer reads in order, words of a block joined, tagged H1 and P, every drawing an artifact.
    expect(d).toContain('/Artifact BMC');
    expect(d).toContain('/H1 << /MCID 0 >> BDC');
    expect(d).toContain('3 Tr');
    const type3 = pdf.find('/Subtype /Type3');
    expect(type3).toHaveLength(1);
    expect(pdf.text).toContain('/StructTreeRoot');
    // One P for the block's two words, one each for the untagged lines (Outlined, Grad, Half).
    expect(pdf.find('/S /P ')).toHaveLength(4);
    expect(pdf.text).toContain('/MarkInfo << /Marked true >>');
    // Fonts were registered for the page and released after.
    expect(dom.added.length).toBe(2);
    expect(dom.deleted.length).toBe(2);
    // The hidden text is neither drawn nor read.
    const cmap = [...pdf.objects.values()].find((o) => o.stream?.includes('beginbfchar'))!.stream!;
    expect(cmap).not.toContain('<005A>');
  });

  it('sets text in a system stack in the fallback face, when the caller gives it', async () => {
    const fallbackFontCss = vi.fn(async () => faceCss('Inter'));
    const body = `<text x="10" y="20" font-family="system-ui, sans-serif" font-size="12">Label<tspan>s</tspan></text>`;
    const pdf = await write([{ svg: svg(body) }, { svg: svg(body) }], { fallbackFontCss });
    expect(fallbackFontCss).toHaveBeenCalledTimes(1);
    expect(images(pdf)).toHaveLength(0);
    expect(pdf.find('/Subtype /Form').length).toBeGreaterThan(0);
    // A page whose text has its own face doesn't ask for it.
    const other = vi.fn(async () => faceCss('Inter'));
    await write(
      svg(
        '<text font-family="Body">x</text><rect width="1" height="1"/>',
        undefined,
        faceCss('Body'),
      ),
      {
        fallbackFontCss: other,
      },
    );
    expect(other).not.toHaveBeenCalled();
  });

  it('draws text it can’t outline as a picture, its words still in the text layer', async () => {
    // No fallback face given, one that fails, and one that is not Inter: each a picture with readable text.
    for (const fallbackFontCss of [
      undefined,
      async () => {
        throw new Error('offline');
      },
      async () => faceCss('Other'),
    ]) {
      const pdf = await write(svg('<g><text x="1" y="10" font-family="system-ui">Hi</text></g>'), {
        fallbackFontCss,
      });
      expect(images(pdf)).toHaveLength(1);
      expect(pdf.find('/Subtype /Type3')).toHaveLength(1);
    }
    // A letter outside the face, and text inside a filtered group, are pictures too, still read.
    const pdf = await write(
      svg(
        `<text x="1" y="10" font-family="Body">€</text>
         <defs><filter id="f"/></defs>
         <g filter="url(#f)"><text x="1" y="30" font-family="Body">Shadow</text><svg x="0" y="0" width="5" height="5"><text font-family="Body">in</text></svg><desc>d</desc></g>`,
        undefined,
        `@font-face { font-family: 'Body'; src: url(${FACE_DATA}); unicode-range: U+0000-00FF; }`,
      ),
    );
    expect(images(pdf)).toHaveLength(2);
    const cmap = [...pdf.objects.values()].find((o) => o.stream?.includes('beginbfchar'))!.stream!;
    expect(cmap).toContain('<20AC>');
    expect(cmap).toContain('<0053>');
  });

  it('loads fontkit only when a page has text and faces', async () => {
    const loadFontkit = vi.fn(async () => fakeFontkit() as never);
    await svgPagesToPdf(
      [{ svg: svg('<rect width="1" height="1"/>', undefined, faceCss('Body')) }],
      { loadFontkit },
    );
    expect(loadFontkit).not.toHaveBeenCalled();
    await svgPagesToPdf(
      [
        { svg: svg('<text font-family="Body">a</text>', undefined, faceCss('Body')) },
        { svg: svg('<text font-family="Body">b</text>', undefined, faceCss('Body')) },
      ],
      { loadFontkit },
    );
    expect(loadFontkit).toHaveBeenCalledTimes(1);
  });
});

describe('colours a canvas reads', () => {
  it('reads a colour the table doesn’t know through the canvas, and none for one it can’t', async () => {
    const pdf = await write(
      svg(
        '<rect width="5" height="5" fill="rebeccapurple"/><rect width="5" height="5" fill="nonsense"/>',
      ),
    );
    expect(drawing(pdf)).toContain('0.4 0.2 0.6 rg');
  });
});

describe('the fallback picture', () => {
  it('is drawn at the raster scale, cut to the page, with soft edges for translucency', async () => {
    vi.unstubAllGlobals();
    dom = installDom({ alpha: 128 });
    const pdf = await write(
      svg(`<defs><filter id="f" x="-10" y="-10" width="20" height="20" filterUnits="userSpaceOnUse"/></defs>
        <rect x="-50" y="-50" width="400" height="400" fill="red" filter="url(#f)"/>
        <rect x="300" y="300" width="4" height="4" fill="red" filter="url(#f)"/>
        <rect x="10" y="10" width="4" height="4" fill="red" style="filter: blur(2px)"/>`),
      { rasterScale: 1 },
    );
    const imgs = images(pdf);
    // The one off the page draws nothing.
    expect(imgs.length).toBe(2);
    expect(imgs[0]!.dict).toContain('/SMask');
    expect(imgs[0]!.dict).toMatch(/\/Width 2\d\d? /);
  });

  it('gives up on a picture that fails to draw, leaving the rest', async () => {
    vi.stubGlobal(
      'XMLSerializer',
      class {
        serializeToString = () => 'broken';
      },
    );
    const pdf = await write([
      {
        svg: svg('<rect width="4" height="4" fill="red" style="filter: blur(1px)"/>'),
        raster: async () => document.createElement('canvas'),
      },
    ]);
    expect(images(pdf)).toHaveLength(1);
  });
});

describe('figures', () => {
  it('tags a described picture as a Figure with its alt text, an undescribed one an artifact', async () => {
    const pdf = await write(
      svg(`<rect width="10" height="10" fill="red"/>
      <g data-pdf-alt=" A red square " clip-path="url(#c)"><rect x="0" y="40" width="20" height="20" fill="red"/></g>
      <rect y="20" width="10" height="10" fill="blue" data-pdf-alt="A blue square" transform="translate(5 0)"/>
      <rect y="60" width="10" height="10" data-pdf-alt="A low square"/>
      <rect y="5" width="10" height="10" data-pdf-alt="A high square" data-no-bbox=""/>
      <rect width="10" height="10" data-pdf-alt="Hidden" style="display: none"/>
      <rect width="10" height="10" data-pdf-alt="  "/>
      <clipPath id="c"><rect width="200" height="100"/></clipPath>`),
    );
    // Undescribed pictures and every other drawing stay in the artifact, closed around each figure.
    const d = drawing(pdf);
    expect(d).toMatch(/^\/Artifact BMC\nq\n0.75 0 0 -0.75 0 75 cm\n/);
    expect(d).toContain('EMC\n/Figure << /MCID 0 >> BDC\nq\n');
    expect(d).toContain('EMC\n/Figure << /MCID 1 >> BDC\nq\n1 0 0 1 5 0 cm');
    expect(pdf.text).toContain('/MarkInfo << /Marked true >>');
    // In reading order by their top edge: the blue square (y 20) before the low one (y 60); a group's box is its
    // children's in a browser (test-dom stands it at 0 0); one with no box goes last.
    expect(structDump(pdf)).toBe(
      [
        'Document',
        '  Figure "A red square" [0:0]',
        '  Figure "A blue square" [0:1]',
        '  Figure "A low square" [0:2]',
        '  Figure "A high square" [0:3]',
      ].join('\n'),
    );
  });

  it('makes a translucent group or a fallback picture the Figure of the described pictures inside it', async () => {
    const pdf = await write(
      svg(`<g opacity="0.5"><rect width="10" height="10" data-pdf-alt="Faded"/><g opacity="0.5"><rect width="5" height="5" data-pdf-alt="Fainter"/></g></g>
      <g opacity="0.5"><rect width="10" height="10"/></g>
      <g filter="url(#blur)" data-pdf-alt="Blurred"><rect y="50" width="10" height="10" data-pdf-alt="its square"/></g>
      <g filter="url(#blur)"><rect y="60" width="10" height="10"/></g>
      <rect width="50" height="20" fill="url(#dots)"/>
      <filter id="blur"><feGaussianBlur stdDeviation="1"/></filter>
      <pattern id="dots" patternUnits="userSpaceOnUse" width="10" height="10"><rect width="2" height="2" data-pdf-alt="A dot"/></pattern>`),
    );
    const d = drawing(pdf);
    expect(d).toMatch(
      /EMC\n\/Figure << \/MCID 0 >> BDC\n\/G\d+ gs\n\/X\d+ Do\nEMC\n\/Artifact BMC/,
    );
    // A pattern's tile is decoration, and so is a group or a picture with nothing described in it.
    expect(structDump(pdf)).toBe(
      ['Document', '  Figure "Faded. Fainter" [0:0]', '  Figure "Blurred. its square" [0:1]'].join(
        '\n',
      ),
    );
    expect(d.match(/\/Figure/g)).toHaveLength(2);
  });

  it('takes a page’s figures back when the page is drawn as a picture', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      if (el.hasAttribute('data-boom')) throw new Error('boom');
      return getComputedStyle(el, pseudo);
    });
    const pdf = await write([
      {
        svg: svg(
          '<rect width="4" height="4" data-pdf-alt="Lost"/><rect data-boom="" width="4" height="4"/>',
        ),
        raster: async () => canvas,
      },
      { svg: svg('<rect width="4" height="4" data-pdf-alt="Kept"/>') },
    ]);
    expect(structDump(pdf)).toBe(['Document', '  Figure "Kept" [1:0]'].join('\n'));
    expect(pdf.find('/Nums [')[0]!.dict).toMatch(/\/Nums \[0 \[\] 1 \[\d+ 0 R\]\]/);
  });

  it('reads an article’s list and table with a described picture in its place', async () => {
    const t = (x: number, y: number, tag: string, block: number, words: string) =>
      `<text x="${x}" y="${y}" font-family="Body" font-size="10" data-pdf-tag="${tag}" data-pdf-block="${block}">${words}</text>`;
    const pdf = await write(
      svg(
        // The writing draws every marker first; each reads with its item, apart from its words.
        `${t(10, 20, 'L#l0/LI#i1/Lbl#m1', 1, '1.')}${t(10, 30, 'L#l0/LI#i2/Lbl#m2', 2, '2.')}
        ${t(10, 10, 'H1', 0, 'Title')}${t(30, 20, 'L#l0/LI#i1/LBody', 1, 'One')}${t(30, 30, 'L#l0/LI#i2/LBody', 2, 'Two')}
        ${t(10, 80, 'Table#t0/TR#r0/TH', 3, 'Name')}${t(60, 80, 'Table#t0/TR#r0/TH', 4, 'Age')}
        ${t(10, 90, 'Table#t0/TR#r1/TD', 5, 'Ada')}${t(60, 90, 'Table#t0/TR#r1/TD', 6, '36')}
        <g data-pdf-empty="" data-pdf-tag="Table#t0/TR#r1/TD" data-pdf-block="7" transform="translate(110 90)"/>
        <g data-pdf-empty="" data-pdf-tag="Table#t0/TR#r1/TD"/><g data-pdf-empty="" data-pdf-block="9"/>
        <rect width="50" height="20" fill="url(#cells)"/>
        <pattern id="cells" patternUnits="userSpaceOnUse" width="10" height="10"><rect width="2" height="2"/><g data-pdf-empty="" data-pdf-tag="P" data-pdf-block="8"/></pattern>
        <rect y="40" width="10" height="10" data-pdf-alt="A map"/>`,
        undefined,
        faceCss('Body'),
      ),
    );
    expect(structDump(pdf)).toBe(
      [
        'Document',
        '  H1 [0:1]',
        '  L',
        '    LI',
        '      Lbl [0:2]',
        '      LBody [0:3]',
        '    LI',
        '      Lbl [0:4]',
        '      LBody [0:5]',
        '  Figure "A map" [0:0]',
        '  Table',
        '    TR',
        '      TH Column [0:6]',
        '      TH Column [0:7]',
        '    TR',
        '      TD [0:8]',
        '      TD [0:9]',
        '      TD',
      ].join('\n'),
    );
  });

  it('leaves a PDF with no described picture and no tags untagged', async () => {
    const pdf = await write(svg('<rect width="4" height="4"/>'));
    expect(structDump(pdf)).toBe('(untagged)');
  });
});
