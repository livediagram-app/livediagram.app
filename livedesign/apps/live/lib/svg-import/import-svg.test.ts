// @vitest-environment jsdom
// docs/specs/020-import-export/svg-import.md: SVG text to path elements fitted to the page's safe area, the report,
// the trust rules (parseInert only; scripts, foreignObject and outside references dropped) and the limits.
import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { pathAnchors, pathContours, type PathElement } from '@livedesign/design';
import { loadCombineEngine } from '@/lib/combine/combine';
import { importSvgText, type SvgImportResult } from './import-svg';
import { svgReportLines } from './report';

const parseSpy = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('@liveworkspace/trusted-types', async (importOriginal) => {
  const real = await importOriginal<typeof import('@liveworkspace/trusted-types')>();
  return {
    ...real,
    parseInert: (source: string, type: DOMParserSupportedType) => {
      parseSpy.calls.push(type);
      return real.parseInert(source, type);
    },
  };
});

const logSpy = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('@liveworkspace/workbench/lib/debug-log', () => ({
  debugLog: (...args: unknown[]) => logSpy.calls.push(args),
}));

const BOX = { x: 100, y: 50, width: 400, height: 300 };
const deps = { loadEngine: loadCombineEngine };
const svg = (body: string, attrs = 'viewBox="0 0 100 100"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${body}</svg>`;

async function shapes(
  text: string,
  into = BOX,
): Promise<Extract<SvgImportResult, { kind: 'shapes' }>> {
  const r = await importSvgText(text, into, 'dialog', deps);
  if (r.kind !== 'shapes') throw new Error(`expected shapes, got ${JSON.stringify(r)}`);
  return r;
}

// A point along a cubic between two anchors of a path, in canvas px.
function curvePoints(el: PathElement): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const nodes of pathContours(el)) {
    const a = pathAnchors({ ...el, nodes });
    const n = el.closed ? a.length : a.length - 1;
    for (let i = 0; i < n; i++) {
      const p0 = a[i]!;
      const p3 = a[(i + 1) % a.length]!;
      const c1 = p0.handleOut ?? p0;
      const c2 = p3.handleIn ?? p3;
      for (let t = 0; t <= 1; t += 0.125) {
        const u = 1 - t;
        out.push({
          x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
          y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
        });
      }
    }
  }
  return out;
}

describe('importSvgText: geometry', () => {
  it('parses only through parseInert', async () => {
    parseSpy.calls.length = 0;
    await shapes(svg('<rect width="10" height="10"/>'));
    expect(parseSpy.calls).toEqual(['image/svg+xml']);
  });

  it('brings a logo with an O in as one compound path, curves kept, fitted and centred in the box', async () => {
    // An O drawn as two circles of opposite direction (nonzero, where even-odd paints the same).
    const o = 'M50 10 A40 40 0 1 1 49.99 10 Z M50 30 A20 20 0 1 0 50.01 30 Z';
    const { paths } = await shapes(svg(`<path fill="#E30613" d="${o}"/>`));
    expect(paths).toHaveLength(1);
    const p = paths[0]!;
    expect(p.subpaths).toHaveLength(1);
    expect(p.fillColor).toBe('#e30613');
    expect(p.strokeWidth).toBe('none');
    expect(p.closed).toBe(true);
    expect(p.nodes.some((n) => n.handleOut)).toBe(true);
    expect(p.nodes.some((n) => n.mode === 'mirrored' || n.mode === 'aligned')).toBe(true);
    // Fitted: it fills the box's height (the shorter side) and is centred across it.
    expect(p.height).toBeCloseTo(300, 1);
    expect(p.y).toBeCloseTo(50, 1);
    expect(p.x + p.width / 2).toBeCloseTo(300, 1);
  });

  it('keeps one path per element, in the file order, groups passing on transform and style', async () => {
    const { paths } = await shapes(
      svg(`<g fill="#ff0000" transform="translate(10 0)"><rect width="10" height="10"/>
        <circle cx="30" cy="5" r="5" fill="blue"/></g><g style="fill: lime"><path d="M50 0 h10 v10 z"/></g>`),
    );
    expect(paths.map((p) => p.fillColor)).toEqual(['#ff0000', '#0000ff', '#00ff00']);
    // The rect sits left of the circle, which sits left of the triangle.
    expect(paths[0]!.x).toBeLessThan(paths[1]!.x);
    expect(paths[1]!.x).toBeLessThan(paths[2]!.x);
  });

  it('turns arcs under transforms into cubics within 0.25 px of the source', async () => {
    // A circle stretched into an ellipse and rotated: landed, it is an ellipse about the box's centre.
    const { paths } = await shapes(
      svg(
        '<circle cx="0" cy="0" r="40" transform="translate(50 50) rotate(90) scale(2 1)"/>',
        'viewBox="-100 -100 300 300"',
      ),
      { x: 0, y: 0, width: 400, height: 800 },
    );
    const p = paths[0]!;
    // Rotated a quarter turn: tall. Fitted into 400 by 800 it lands 400 wide (rx 200) and 800 tall (ry 400).
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    const rx = p.width / 2;
    const ry = p.height / 2;
    expect(ry / rx).toBeCloseTo(2, 3);
    for (const q of curvePoints(p)) {
      const a = Math.atan2((q.y - cy) / ry, (q.x - cx) / rx);
      const onEllipse = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
      expect(Math.hypot(q.x - onEllipse.x, q.y - onEllipse.y)).toBeLessThan(0.25);
    }
  });

  it('resolves a nonzero fill even-odd would cut into a solid outline of corner nodes', async () => {
    const { paths } = await shapes(svg('<path d="M0 0 H100 V100 H0 Z M25 25 H75 V75 H25 Z"/>'));
    expect(paths[0]!.subpaths).toBeUndefined();
    expect(paths[0]!.nodes.every((n) => n.mode === 'corner' && !n.handleIn)).toBe(true);
    // An even-odd fill keeps its hole.
    const eo = await shapes(
      svg('<path fill-rule="evenodd" d="M0 0 H100 V100 H0 Z M25 25 H75 V75 H25 Z"/>'),
    );
    expect(eo.paths[0]!.subpaths).toHaveLength(1);
  });

  it('makes a stroke-only path open, its preset snapped from the landed width', async () => {
    const { paths } = await shapes(
      svg('<path d="M0 0 L100 100" fill="none" stroke="#000" stroke-width="1"/>'),
      { x: 0, y: 0, width: 400, height: 400 },
    );
    expect(paths[0]!.closed).toBe(false);
    expect(paths[0]!.fillColor).toBeUndefined();
    expect(paths[0]!.strokeColor).toBe('#000000');
    // One unit lands at 4 px: Thick.
    expect(paths[0]!.strokeWidth).toBe('thick');
  });

  it('fills the box when its strokes land within the presets, and with no strokes at all', async () => {
    const thin = await shapes(
      svg('<path d="M0 0 L100 100" fill="none" stroke="#000" stroke-width="0.5"/>'),
      { x: 0, y: 0, width: 400, height: 400 },
    );
    // The stroke's half width either side counts: 100.5 units fill 400 px, the line itself 398 px.
    expect(thin.paths[0]!.width).toBeCloseTo((400 * 100) / 100.5, 5);
    const filled = await shapes(svg('<rect width="10" height="10"/>', 'viewBox="0 0 10 10"'), {
      x: 0,
      y: 0,
      width: 400,
      height: 400,
    });
    expect(filled.paths[0]!.width).toBeCloseTo(400, 5);
  });

  it('keeps a closed contour closed by a final node in an open unfilled path', async () => {
    const { paths } = await shapes(
      svg('<path d="M0 0 L50 0 L50 50 Z M60 60 L90 90" fill="none" stroke="red"/>'),
    );
    expect(paths[0]!.closed).toBe(false);
    const first = paths[0]!.nodes;
    expect(first).toHaveLength(4);
    expect(first[3]).toMatchObject({ nx: first[0]!.nx, ny: first[0]!.ny });
  });

  it('places a nested svg by its viewBox and walks again when the content lands far larger than guessed', async () => {
    const { paths } = await shapes(
      svg(
        '<svg x="10" y="10" width="10" height="10" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg>',
        'viewBox="0 0 1000 1000"',
      ),
    );
    // A circle 10 units across in a 1000-unit file still lands filling the box, round within tolerance.
    const p = paths[0]!;
    expect(p.width).toBeCloseTo(300, 1);
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    for (const q of curvePoints(p))
      expect(Math.abs(Math.hypot(q.x - cx, q.y - cy) - 150)).toBeLessThan(0.25);
  });

  it('places a nested svg without a viewBox by its x and y', async () => {
    const { paths } = await shapes(
      svg('<svg x="50"><rect width="10" height="10"/></svg><rect width="10" height="10"/>'),
    );
    expect(paths[0]!.x).toBeGreaterThan(paths[1]!.x);
  });
});

describe('importSvgText: style', () => {
  it('reads <style> classes, the style attribute, currentColor, opacity and fill-opacity', async () => {
    const { paths } = await shapes(
      svg(`<style>.brand { fill: #123456 } #accent { fill: hsl(0 100% 50%) }</style>
        <g color="#00ff00" opacity="0.5"><rect class="brand" width="10" height="10"/>
        <rect id="accent" x="20" width="10" height="10" fill-opacity="0.5"/>
        <rect x="40" width="10" height="10" style="fill: currentColor; opacity: 1"/></g>`),
    );
    expect(paths.map((p) => p.fillColor)).toEqual(['#123456', '#ff0000', '#00ff00']);
    expect(paths.map((p) => p.opacity)).toEqual([0.5, 0.25, 0.5]);
  });

  it('draws nothing hidden or unpainted', async () => {
    const { paths } = await shapes(
      svg(`<rect width="10" height="10" display="none"/><g style="display:none"><rect width="5" height="5"/></g>
        <rect width="10" height="10" visibility="hidden"/><rect width="10" height="10" fill="none"/>
        <rect width="10" height="10" fill="transparent"/><rect width="10" height="10" fill-opacity="0"/>
        <rect width="10" height="10" stroke="red" stroke-width="0" fill="none"/>
        <g visibility="hidden"><rect x="50" width="10" height="10" visibility="visible"/></g>
        <defs><rect id="d" width="10" height="10"/></defs><rect width="10" height="10" fill="inherit"/>`),
    );
    expect(paths).toHaveLength(2);
  });

  it('takes a gradient first stop, following href, and reports it', async () => {
    const r = await shapes(
      svg(`<defs><linearGradient id="base"><stop offset="0" stop-color="#ff8800" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#000"/></linearGradient>
        <radialGradient id="ref" xlink:href="#base"/><linearGradient id="nostops"/>
        <linearGradient id="badstop"><stop style="stop-color: wobble"/></linearGradient>
        <pattern id="pat"/></defs>
        <rect width="10" height="10" fill="url(#ref)"/>
        <rect x="20" width="10" height="10" fill="url('#base')" stroke="url(#pat) #0000ff"/>
        <rect x="40" width="10" height="10" fill="url(#pat)" stroke="url(#nostops)"/>
        <rect x="60" width="10" height="10" fill="url(#badstop)" stroke="url(#missing) red"/>
        <rect x="80" width="10" height="10" fill="url(#nowhere"/>`),
    );
    expect(r.paths).toHaveLength(3);
    expect(r.paths[0]!.fillColor).toBe('#ff8800');
    expect(r.paths[0]!.opacity).toBe(0.5);
    expect(r.paths[1]!.strokeColor).toBe('#0000ff');
    expect(r.paths[2]!.strokeColor).toBe('#ff0000');
    expect(r.report.gradient).toBe(4);
    expect(r.report.pattern).toBe(2);
  });

  it('lists text, masks, filters, clip paths, pictures and patterns in the report', async () => {
    const r = await shapes(
      svg(`<text>Brand</text><text visibility="hidden">x</text><image href="#x"/><image visibility="hidden"/>
        <rect width="10" height="10" mask="url(#m)" filter="url(#f)" clip-path="url(#c)"/>
        <rect width="10" height="10" fill="url(#p)"/><defs><pattern id="p"/></defs>`),
    );
    expect(r.report).toMatchObject({
      text: 1,
      image: 1,
      mask: 1,
      filter: 1,
      clipPath: 1,
      pattern: 1,
    });
    expect(svgReportLines(r.report).map((l) => l.title)).toEqual([
      'Text',
      'Masks',
      'Filters',
      'Clip paths',
      'Pictures',
      'Patterns',
    ]);
  });
});

describe('importSvgText: trust', () => {
  it('never draws scripts, foreignObject content or outside references', async () => {
    const { paths } = await shapes(
      svg(`<script>window.hacked = true</script>
        <foreignObject width="10" height="10"><svg><rect width="10" height="10"/></svg></foreignObject>
        <rect id="local" width="10" height="10" onclick="window.hacked = true"/>
        <use href="https://example.com/evil.svg#x"/><use xlink:href="data:image/svg+xml,&lt;svg/&gt;"/>
        <use href="#local" x="50"/><use href="#missing"/>`),
    );
    // The local rect and its one local use; nothing else.
    expect(paths).toHaveLength(2);
    expect((window as unknown as { hacked?: boolean }).hacked).toBeUndefined();
  });

  it('follows a use into a symbol, stops a use that reaches itself, and goes at most 8 deep', async () => {
    const chain = Array.from(
      { length: 12 },
      (_, i) => `<g id="u${i + 1}"><use href="#u${i}"/></g>`,
    ).join('');
    const { paths } = await shapes(
      svg(`<defs><symbol id="s"><rect width="5" height="5"/></symbol><g id="loop"><use href="#loop"/></g>
        <rect id="u0" width="2" height="2"/>${chain}</defs>
        <use href="#s"/><use href="#loop"/><use href="#u12" x="20"/><use href="#u3" x="40"/>`),
    );
    // The symbol's rect, and the shallow chain; the loop and the 12-deep chain draw nothing.
    expect(paths).toHaveLength(2);
  });

  it('fails calmly on a file that is not an SVG', async () => {
    const r1 = await importSvgText('not xml at all', BOX, 'paste', deps);
    const r2 = await importSvgText(
      '<html xmlns="http://www.w3.org/1999/xhtml"/>',
      BOX,
      'paste',
      deps,
    );
    const r3 = await importSvgText(
      '<svg xmlns="http://www.w3.org/2000/svg"><g></svg>',
      BOX,
      'paste',
      deps,
    );
    expect([r1.kind, r2.kind, r3.kind]).toEqual(['unreadable', 'unreadable', 'unreadable']);
  });

  it('answers empty, with the report, for a file with nothing to draw', async () => {
    const r = await importSvgText(svg('<text>Only words</text>'), BOX, 'drop', deps);
    expect(r).toEqual({ kind: 'empty', report: expect.objectContaining({ text: 1 }) });
    const flat = await importSvgText(svg('<path d="M0 0 L0 0"/>'), BOX, 'drop', deps);
    expect(flat.kind).toBe('empty');
    // A drawn point boxes to nothing; a stroke along a contour of one node draws nothing either.
    const dot = await importSvgText(
      svg('<path d="M5 5 L5 5 L5 5" stroke="red"/>'),
      BOX,
      'drop',
      deps,
    );
    expect(dot.kind).toBe('empty');
  });
});

describe('importSvgText: limits', () => {
  it('falls back to a picture past 2 MB', async () => {
    const big = svg(`<desc>${'x'.repeat(2 * 1024 * 1024)}</desc>`);
    expect(await importSvgText(big, BOX, 'drop', deps)).toEqual({
      kind: 'picture',
      reason: 'too-large',
    });
    // Multi-byte text past the cap in bytes, under it in characters.
    const wide = svg(`<desc>${'é'.repeat(1024 * 1024 + 10)}</desc>`);
    expect((await importSvgText(wide, BOX, 'drop', deps)).kind).toBe('picture');
  });

  it('falls back to a picture past 5,000 elements, uses counted as they expand', async () => {
    const many = svg('<rect width="1" height="1"/>'.repeat(5_001));
    expect(await importSvgText(many, BOX, 'drop', deps)).toEqual({
      kind: 'picture',
      reason: 'too-many-elements',
    });
    // Ten uses of a group of ten uses of a group of 100 rects: 10,000 drawn from about 130 elements.
    const rects = '<rect width="1" height="1"/>'.repeat(100);
    const tens = '<use href="#a"/>'.repeat(10);
    const fan = svg(
      `<defs><g id="a">${rects}</g><g id="b">${tens}</g></defs>${'<use href="#b"/>'.repeat(10)}`,
    );
    expect((await importSvgText(fan, BOX, 'drop', deps)).kind).toBe('picture');
  });

  it('falls back to a picture when one element would pass 5,000 nodes', async () => {
    const d = `M0 0${' l1 0 l0 1'.repeat(2_600)}`;
    expect(
      await importSvgText(svg(`<path fill="none" stroke="red" d="${d}"/>`), BOX, 'drop', deps),
    ).toEqual({
      kind: 'picture',
      reason: 'too-detailed',
    });
  });

  it('imports a big icon set within its CPU budget', async () => {
    const icons = Array.from(
      { length: 1_000 },
      (_, i) =>
        `<path transform="translate(${(i % 40) * 30} ${Math.floor(i / 40) * 30})" d="M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Zm0 4a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z"/>`,
    ).join('');
    let count = 0;
    const ms = await cpuMsOfAsync(async () => {
      const r = await shapes(svg(icons, 'viewBox="0 0 1200 750"'));
      count = r.paths.length;
    });
    expect(count).toBe(1_000);
    expect(ms).toBeLessThan(cpuBudgetMs(3_000));
  });
});

// Work Tracker 1104: bold stroked icons fill the page, their strokes past Extra thick outlined.
describe('importSvgText: strokes', () => {
  // A 1024 px page's safe area (the page less its 40 px margin).
  const PAGE = { x: 40, y: 40, width: 944, height: 944 };
  const lucide = (body: string) =>
    svg(
      body,
      'viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"',
    );
  const boxOf = (paths: PathElement[]) => ({
    x0: Math.min(...paths.map((p) => p.x)),
    y0: Math.min(...paths.map((p) => p.y)),
    x1: Math.max(...paths.map((p) => p.x + p.width)),
    y1: Math.max(...paths.map((p) => p.y + p.height)),
  });

  it('outlines a bold Lucide icon so it fills a 1024 px page with its source proportions', async () => {
    // Lucide's circle-check: a 20-unit ring and a tick, 2-unit round strokes.
    const { paths, made } = await shapes(
      lucide('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
      PAGE,
    );
    expect(made.outlined).toBe(2);
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(p.fillColor).toBe('#1d4ed8');
      expect(p.strokeWidth).toBe('none');
      expect(p.strokeColor).toBeUndefined();
      expect(p.closed).toBe(true);
    }
    // The ring with its stroke is 22 units: it fills the safe area, centred.
    const b = boxOf(paths);
    expect(b.x1 - b.x0).toBeCloseTo(944, 0);
    expect(b.y1 - b.y0).toBeCloseTo(944, 0);
    expect(b.x0).toBeCloseTo(40, 0);
    // The ring keeps its hole: a stroke 2 / 22 of the width, so its hole is 18 / 22 across.
    const ring = paths[0]!;
    expect(ring.subpaths).toHaveLength(1);
    const hole = ring.subpaths![0]!;
    const holeWidth =
      (Math.max(...hole.map((n) => n.nx)) - Math.min(...hole.map((n) => n.nx))) * ring.width;
    expect(holeWidth).toBeCloseTo((944 * 18) / 22, 0);
    // The tick lands in proportion: 6 units plus its 2-unit stroke across, of 22.
    expect(paths[1]!.width).toBeCloseTo((944 * 8) / 22, 0);
  });

  it('outlines a Tabler icon with its square caps and miter joins as drawn', async () => {
    const { paths } = await shapes(
      svg(
        '<path d="M4 4h16v16" fill="none" stroke="#000" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>',
        'viewBox="0 0 24 24"',
      ),
      PAGE,
    );
    // A square cap and a mitered corner make a sharp L, 18 units square with its stroke: 4 corners and 2 at the
    // inside, nothing rounded.
    expect(paths[0]!.nodes).toHaveLength(6);
    expect(paths[0]!.width).toBeCloseTo(944, 0);
    expect(paths[0]!.height).toBeCloseTo(944, 0);
  });

  it('keeps a thin-stroked icon editable as strokes', async () => {
    // A 1024-unit drawing with 4-unit strokes lands at about 0.9x: Medium-ish lines, well under Extra thick.
    const { paths, made } = await shapes(
      svg(
        '<circle cx="512" cy="512" r="400" fill="none" stroke="#111" stroke-width="4"/><path d="M312 512h400" fill="none" stroke="#111" stroke-width="4"/>',
        'viewBox="0 0 1024 1024"',
      ),
      PAGE,
    );
    expect(made.outlined).toBe(0);
    expect(paths.map((p) => p.strokeColor)).toEqual(['#111111', '#111111']);
    expect(paths[1]!.closed).toBe(false);
    expect(paths.every((p) => p.strokeWidth !== 'none' && p.fillColor === undefined)).toBe(true);
  });

  it('outlines only the strokes past 7 px, and lands a filled and stroked element as its fill below its outline', async () => {
    const { paths, made } = await shapes(
      svg(
        '<rect x="2" y="2" width="20" height="20" fill="#fde047" stroke="#000" stroke-width="2"/><path d="M6 12h12" fill="none" stroke="#f00" stroke-width="0.1"/>',
        'viewBox="0 0 24 24"',
      ),
      PAGE,
    );
    expect(made.outlined).toBe(1);
    expect(paths.map((p) => [p.fillColor, p.strokeColor, p.strokeWidth])).toEqual([
      ['#fde047', undefined, 'none'],
      ['#000000', undefined, 'none'],
      // 0.1 units at 43x: about 4.3 px, a stroke still.
      [undefined, '#ff0000', 'thick'],
    ]);
  });

  it('carries the stroke opacity onto the outline and lets a dot paint', async () => {
    const { paths } = await shapes(
      lucide('<path d="M12 8h.01" stroke-opacity="0.5" opacity="0.8"/><path d="M12 12v4"/>'),
      PAGE,
    );
    expect(paths[0]!.opacity).toBe(0.4);
    expect(paths[0]!.fillColor).toBe('#1d4ed8');
  });

  it('drops a butt-capped zero-length stroke past 7 px, as SVG paints nothing for it', async () => {
    const { paths } = await shapes(
      svg(
        '<path d="M12 8h0" stroke="#000" stroke-width="2"/><path d="M4 4h16" stroke="#000" stroke-width="2"/>',
        'viewBox="0 0 24 24"',
      ),
      PAGE,
    );
    expect(paths).toHaveLength(1);
  });

  it('keeps a stroke a stroke when the engine cannot outline it', async () => {
    const real = await loadCombineEngine();
    const r = await importSvgText(lucide('<path d="M4 4h16"/>'), PAGE, 'dialog', {
      loadEngine: async () => ({
        ...real,
        union: () => {
          throw new Error('round-off');
        },
      }),
    });
    if (r.kind !== 'shapes') throw new Error(r.kind);
    expect(r.made.outlined).toBe(0);
    expect(r.paths[0]!.strokeWidth).toBe('extra-thick');
  });

  it('logs how many strokes were outlined', async () => {
    logSpy.calls.length = 0;
    await shapes(lucide('<path d="M4 4h16"/>'), PAGE);
    expect(logSpy.calls).toEqual([
      ['[svg-import]', expect.objectContaining({ outcome: 'shapes', outlined: 1, nonzero: 0 })],
    ]);
  });
});
