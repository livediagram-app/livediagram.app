import { describe, expect, it } from 'vitest';
import {
  type ArrowElement,
  type ShapeElement,
  type Tab,
  TAB_SCHEMA_VERSION,
  tabToJsonText,
  type ExportedTabEnvelope,
} from '@livedesign/design';
import { exportScale, exportTabAsSvg, MAX_EXPORT_CANVAS_SIDE, renderTabToSvg } from './export-tab';
import { parseImportedTab } from './import-tab';

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

const pinnedArrow = (
  id: string,
  fromId: string,
  toId: string,
  label?: string,
  overrides: Partial<ArrowElement> = {},
): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: fromId, anchor: 'e' },
  to: { kind: 'pinned', elementId: toId, anchor: 'w' },
  ...(label ? { label } : {}),
  ...overrides,
});

const tab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 'tab-1',
  name: 'My Tab',
  elements: [],
  ...overrides,
});

const text = async (blob: Blob | Promise<Blob>) => (await blob).text();

// The tab -> JSON serialiser is a string (tabToJsonText); these tests exercise it through a Blob (mime type +
// async .text()), so they wrap the string locally rather than the product shipping an unused Blob-returning helper
// just for the test.
const exportTabAsJson = (t: Tab) => new Blob([tabToJsonText(t)], { type: 'application/json' });

describe('exportTabAsJson', () => {
  it('wraps the tab in a versioned envelope', async () => {
    const blob = exportTabAsJson(tab());
    expect(blob.type).toBe('application/json');
    const env = JSON.parse(await text(blob)) as ExportedTabEnvelope;
    expect(env.kind).toBe('livedesign.tab');
    expect(env.schemaVersion).toBe(TAB_SCHEMA_VERSION);
    expect(typeof env.exportedAt).toBe('number');
    expect(env.tab.id).toBe('tab-1');
  });

  it('round-trips cleanly back through parseImportedTab', async () => {
    const original = tab({ elements: [shape('a', { label: 'Box' })] });
    const result = parseImportedTab(await text(exportTabAsJson(original)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tab).toEqual(original);
  });
});

async function blobType(blob: Blob | Promise<Blob>): Promise<string> {
  return (await blob).type;
}

// docs/specs/007-editor/wireframe-pages.md "The Inspect panel": an element exported on its own.
describe('renderTabToSvg for Inspect', () => {
  it('cuts to the content on a clear ground at the scale’s size', () => {
    const svg = renderTabToSvg(tab({ elements: [shape('a')], backgroundColor: '#fff7ed' }), {
      scale: 3,
      padding: 0,
      transparent: true,
    });
    expect(svg).toMatch(/<svg [^>]*width="300" height="240" viewBox="0 0 100 80"/);
    expect(svg).not.toContain('#fff7ed');
  });

  it('keeps its padding and ground by default', () => {
    const svg = renderTabToSvg(tab({ elements: [shape('a')], backgroundColor: '#fff7ed' }));
    expect(svg).toContain('fill="#fff7ed"');
    expect(svg).not.toMatch(/viewBox="0 0 100 80"/);
  });
});

describe('exportTabAsSvg', () => {
  it('produces an image/svg+xml blob with a viewBox + background', async () => {
    const blob = exportTabAsSvg(tab({ elements: [shape('a')], backgroundColor: '#fff7ed' }));
    expect(await blobType(blob)).toBe('image/svg+xml');
    const svg = await text(blob);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('fill="#fff7ed"'); // background rect
    expect(svg).toContain('</svg>');
  });

  it('renders a circle shape as an ellipse and a square as a rect', async () => {
    const svg = await text(
      exportTabAsSvg(tab({ elements: [shape('c', { shape: 'circle' }), shape('s', { x: 200 })] })),
    );
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('<rect'); // the square (plus the bg rect)
  });

  it('draws an arrow as a path with an arrowhead and escapes the label', async () => {
    const svg = await text(
      exportTabAsSvg(
        tab({
          elements: [
            shape('a'),
            shape('b', { x: 300 }),
            pinnedArrow('arr', 'a', 'b', 'A & B <ok>'),
          ],
        }),
      ),
    );
    // Arrows render via the shared arrow path (straight = M…L…), so curved /
    // angled arrows export with their real shape rather than a flat line.
    expect(svg).toContain('<path d="M ');
    expect(svg).toContain('<polygon'); // arrowhead
    // Label is XML-escaped, never raw.
    expect(svg).toContain('A &amp; B &lt;ok&gt;');
    expect(svg).not.toContain('A & B <ok>');
  });

  // An exported file leaves this browser: the reader hasn't got Permanent
  // Marker installed, so the download carries the face with it (docs/specs/004-interface-design/fonts.md).
  it('embeds the webfont bytes a downloaded file needs', async () => {
    const svg = await text(
      exportTabAsSvg(tab({ elements: [shape('s', { label: 'Hi', font: 'caveat' })] }), {
        fontCss: "@font-face{font-family:'Caveat';src:url(data:font/woff2;base64,AAAA)}",
      }),
    );
    expect(svg).toContain('<style type="text/css">@font-face');
    expect(svg).toContain('data:font/woff2;base64');
    // The declaration-only fallback isn't ALSO emitted — one source of truth
    // for the face, and no pointless network hop for an offline reader.
    expect(svg).not.toContain('@import');
  });

  it('says nothing about fonts when the tab uses none', async () => {
    const svg = await text(exportTabAsSvg(tab({ elements: [shape('s', { label: 'Hi' })] })));
    expect(svg).not.toContain('<style');
  });

  it('paints the backdrop pattern by default and omits it when turned off', async () => {
    const themed = tab({
      elements: [shape('s')],
      backgroundPattern: 'grid',
      patternColor: '#334155',
    });
    const withPattern = await text(exportTabAsSvg(themed));
    expect(withPattern).toContain('<pattern id="lvd-export-bg"');
    expect(withPattern).toContain('url(#lvd-export-bg)');

    const without = await text(exportTabAsSvg(themed, { pattern: false }));
    expect(without).not.toContain('lvd-export-bg');
  });

  it('omits the pattern for blank / unset backdrops', async () => {
    const blank = await text(
      exportTabAsSvg(tab({ elements: [shape('s')], backgroundPattern: 'blank' })),
    );
    expect(blank).not.toContain('lvd-export-bg');
    const unset = await text(exportTabAsSvg(tab({ elements: [shape('s')] })));
    expect(unset).not.toContain('lvd-export-bg');
  });

  it('renders a colour-deferring shape with the canvas defaults, not flat white', async () => {
    // A shape with no explicit colours defers to the theme/type defaults; the
    // export must match what the canvas draws (brand-50 fill / brand-500 border)
    // rather than a white box with a slate border.
    const svg = await text(exportTabAsSvg(tab({ elements: [shape('s')] })));
    expect(svg).toContain('fill="#f0f9ff"'); // brand-50
    expect(svg).toContain('stroke="#0ea5e9"'); // brand-500
    expect(svg).not.toContain('stroke="#0f172a"'); // not the old slate-ink default
  });

  it('wraps a long label to multiple lines instead of one overflowing line', async () => {
    const svg = await text(
      exportTabAsSvg(
        tab({
          elements: [
            shape('s', {
              width: 120,
              label: 'This is a long sticky note label that should wrap across lines',
            }),
          ],
        }),
      ),
    );
    // Wrapped labels emit one <tspan> per line; a single line would emit none.
    const tspans = svg.match(/<tspan/g) ?? [];
    expect(tspans.length).toBeGreaterThan(1);
  });

  it('exports a curved arrow as a Bézier path (not a straight chord)', async () => {
    const svg = await text(
      exportTabAsSvg(
        tab({
          elements: [
            shape('a'),
            shape('b', { x: 300 }),
            pinnedArrow('arr', 'a', 'b', '', { arrowStyle: 'curved' }),
          ],
        }),
      ),
    );
    expect(svg).toContain('<path d="M '); // a path...
    expect(svg).toContain(' Q '); // ...with a quadratic curve segment
  });
});

// A Fit to Content page reaches 19200 px (docs/specs/007-editor/pages-mode.md "Sizes"): its
// image is drawn at 2x only while that stays inside the largest canvas every browser draws.
describe('exportScale', () => {
  it('keeps 2x for an ordinary page, and lowers it so no side passes the canvas limit', () => {
    expect(exportScale(2, 1123, 794)).toBe(2);
    expect(exportScale(2, 19200, 1000) * 19200).toBe(MAX_EXPORT_CANVAS_SIDE);
    expect(exportScale(2, 500, 12000) * 12000).toBe(MAX_EXPORT_CANVAS_SIDE);
    expect(exportScale(2, 0, 0)).toBe(2);
  });
});

// The SVG draws arrows as the PNG / PDF do (docs/specs/020-import-export/export-fidelity.md).
// Old work after the isometric view went (docs/specs/008-canvas/canvas-and-palette.md "Retired features"): nothing
// stored was ever isometric, so a tab with a background pattern, and even an old caller
// still passing the export's `isometric` option, exports flat and top-down with its pattern kept.
describe('renderTabToSvg after the isometric view', () => {
  const old = tab({
    backgroundPattern: 'crosshatch',
    elements: [shape('a'), shape('b', { x: 200 })],
  });
  const legacyOpts = { isometric: true, pattern: true } as Parameters<typeof renderTabToSvg>[1];

  it('draws an old tab flat, with no tilt and no extrusion', () => {
    const svg = renderTabToSvg(old, legacyOpts);
    expect(svg).not.toContain('matrix(');
    expect(svg).toContain('<pattern');
  });

  it('gives the same picture with or without the old option', () => {
    expect(renderTabToSvg(old, legacyOpts)).toBe(renderTabToSvg(old, { pattern: true }));
  });
});

describe('renderTabToSvg arrows match the canvas', () => {
  const crossing = (visible: boolean) =>
    tab({
      layers: [
        { id: 'base', name: 'Layer 1' },
        { id: 'secret', name: 'Hidden', visible },
      ],
      elements: [
        shape('a', { layerId: 'base' }),
        shape('b', { x: 400, layerId: 'base' }),
        shape('c', { x: 200, layerId: 'secret' }),
        pinnedArrow('arr', 'a', 'b', undefined, { layerId: 'base' }),
      ],
    });

  it('breaks an arrow behind a box it draws', () => {
    expect(renderTabToSvg(crossing(true))).toContain('<mask');
  });

  it('never breaks an arrow behind a box on a hidden layer', () => {
    expect(renderTabToSvg(crossing(false))).not.toContain('<mask');
  });

  it('fills a hollow head with the tab background, not the default canvas colour', () => {
    const svg = renderTabToSvg(
      tab({
        backgroundColor: '#fde68a',
        elements: [
          shape('a'),
          shape('b', { x: 400 }),
          pinnedArrow('arr', 'a', 'b', undefined, { arrowheadShape: 'triangle-hollow' }),
        ],
      }),
    );
    expect(svg).toMatch(/<polygon points="[^"]*" fill="#fde68a" stroke=/);
  });
});
