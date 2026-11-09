import { describe, expect, it } from 'vitest';
import {
  type Element,
  type ShapeElement,
  type Tab,
  TAB_SCHEMA_VERSION,
  tabToJsonText,
  tabToMarkdownText,
  type ExportedTabEnvelope,
} from '@livehuddle/document';
import { exportScale, exportTabAsSvg, MAX_EXPORT_CANVAS_SIDE } from './export-tab';
import { parseImportedTab } from './import-tab';
import { storedFreehand, storedPinnedArrow } from '@/test/retired-elements';

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

const freehand = (id: string, overrides: Record<string, unknown> = {}): Element =>
  storedFreehand(id, { x: 0, y: 0, width: 60, height: 60 }, overrides);

const pinnedArrow = (
  id: string,
  fromId: string,
  toId: string,
  label?: string,
  overrides: Record<string, unknown> = {},
): Element =>
  storedPinnedArrow(id, fromId, 'e', toId, 'w', { ...(label ? { label } : {}), ...overrides });

const tab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 'tab-1',
  name: 'My Tab',
  elements: [],
  ...overrides,
});

const text = async (blob: Blob | Promise<Blob>) => (await blob).text();

// The tab -> JSON / Markdown serialisers are strings (tabToJsonText /
// tabToMarkdownText); these tests exercise them through a Blob (mime type +
// async .text()), so they wrap the strings locally rather than the product
// shipping unused Blob-returning helpers just for the test.
const exportTabAsJson = (t: Tab) => new Blob([tabToJsonText(t)], { type: 'application/json' });
const exportTabAsMarkdown = (t: Tab) => new Blob([tabToMarkdownText(t)], { type: 'text/markdown' });

describe('exportTabAsJson', () => {
  it('wraps the tab in a versioned envelope', async () => {
    const blob = exportTabAsJson(tab());
    expect(blob.type).toBe('application/json');
    const env = JSON.parse(await text(blob)) as ExportedTabEnvelope;
    expect(env.kind).toBe('livehuddle.tab');
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

describe('exportTabAsMarkdown', () => {
  it('uses the tab name as the H1 heading', async () => {
    const md = await text(exportTabAsMarkdown(tab({ name: 'Architecture' })));
    expect(md.startsWith('# Architecture\n')).toBe(true);
    expect(await blobType(exportTabAsMarkdown(tab()))).toBe('text/markdown');
  });

  it('falls back to "Untitled tab" when the name is empty', async () => {
    const md = await text(exportTabAsMarkdown(tab({ name: '' })));
    expect(md.startsWith('# Untitled tab')).toBe(true);
  });

  it('emits "_No labelled content._" for an empty tab', async () => {
    const md = await text(exportTabAsMarkdown(tab()));
    expect(md).toContain('_No labelled content._');
    expect(md).not.toContain('## Elements');
    expect(md).not.toContain('## Connections');
  });

  it('lists each labelled boxed element as a bold bullet with a type tag', async () => {
    const md = await text(
      exportTabAsMarkdown(
        tab({
          elements: [
            shape('a', { label: 'Alpha' }),
            shape('b', {}), // no label → skipped
            shape('c', { label: 'Gamma', y: 200 }),
          ],
        }),
      ),
    );
    expect(md).toContain('## Elements');
    expect(md).toContain('- **Alpha** (square)');
    expect(md).toContain('- **Gamma** (square)');
    // The unlabelled element contributes no bullet.
    expect(md.match(/^- \*\*/gm)?.length).toBe(2);
  });

  it('orders elements top-to-bottom then left-to-right (y, then x)', async () => {
    const md = await text(
      exportTabAsMarkdown(
        tab({
          elements: [
            shape('right', { label: 'Right', x: 300, y: 0 }),
            shape('left', { label: 'Left', x: 0, y: 0 }),
            shape('below', { label: 'Below', x: 0, y: 300 }),
          ],
        }),
      ),
    );
    const idxLeft = md.indexOf('Left');
    const idxRight = md.indexOf('Right');
    const idxBelow = md.indexOf('Below');
    expect(idxLeft).toBeLessThan(idxRight); // same y-band, left first
    expect(idxRight).toBeLessThan(idxBelow); // higher band before lower
  });

  // A stored arrow is retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4): the
  // Markdown lists no Connections for it, labelled or not.
  it('lists no Connections for a stored arrow', async () => {
    const md = await text(
      exportTabAsMarkdown(
        tab({
          elements: [
            shape('a', { label: 'A' }),
            shape('b', { label: 'B', x: 300 }),
            pinnedArrow('e1', 'a', 'b', 'calls'),
            pinnedArrow('e2', 'a', 'b'),
          ],
        }),
      ),
    );
    expect(md).not.toContain('## Connections');
    expect(md).not.toContain('A → B');
  });

  it('includes labelled freehand strokes in the Elements section with a (freehand) tag', async () => {
    // Regression guard: before isBoxed-driven filtering, the Markdown
    // export hard-coded shape / text / sticky as the only boxed
    // kinds, which silently dropped FreehandElement after it shipped
    // as a first-class boxed type. The downstream tag computation
    // already falls back to `(<type>)` for non-shape kinds, so once
    // the filter lets freehand through the bullet renders correctly.
    const md = await text(
      exportTabAsMarkdown(
        tab({
          elements: [
            shape('s', { label: 'Box', y: 0 }),
            freehand('f', { label: 'Sketch', y: 100 }),
            freehand('u', { y: 200 }), // unlabelled freehand stays dropped
          ],
        }),
      ),
    );
    expect(md).toContain('## Elements');
    expect(md).toContain('- **Box** (square)');
    expect(md).toContain('- **Sketch** (freehand)');
    // The unlabelled freehand contributes no bullet.
    expect(md.match(/^- \*\*/gm)?.length).toBe(2);
  });
});

async function blobType(blob: Blob | Promise<Blob>): Promise<string> {
  return (await blob).type;
}

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

  // A stored arrow exports as it draws on the canvas: a dashed line between its ends and the placeholder card on it.
  it('draws a stored arrow as its dashed line and card, never its raw label', async () => {
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
    expect(svg).toContain('data-retired-arrow="arr"');
    expect(svg).toContain('data-retired-arrow-line=""');
    expect(svg).toContain('stroke-dasharray=');
    expect(svg).not.toContain('A & B <ok>');
  });

  // An exported file leaves this browser: the reader hasn't got Permanent
  // Marker installed, so the download carries the face with it (docs/specs/004-interface-design/fonts.md).
  it('embeds the webfont bytes a downloaded file needs', async () => {
    const svg = await text(
      exportTabAsSvg(tab({ elements: [shape('s', { label: 'Hi', font: 'caveat' })] }), {
        fontCss: "@font-face{font-family:'Kalam';src:url(data:font/woff2;base64,AAAA)}",
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

  it('omits the floor for None, and draws the theme’s floor for an unset one, as the canvas does', async () => {
    const blank = await text(
      exportTabAsSvg(tab({ elements: [shape('s')], backgroundPattern: 'blank' })),
    );
    expect(blank).not.toContain('lvd-export-bg');
    const unset = await text(exportTabAsSvg(tab({ elements: [shape('s')] })));
    expect(unset).toContain('lvd-export-bg');
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
});

// A large tab's image is drawn at 2x only while that stays inside the largest canvas every browser draws.
describe('exportScale', () => {
  it('keeps 2x for an ordinary page, and lowers it so no side passes the canvas limit', () => {
    expect(exportScale(2, 1123, 794)).toBe(2);
    expect(exportScale(2, 19200, 1000) * 19200).toBe(MAX_EXPORT_CANVAS_SIDE);
    expect(exportScale(2, 500, 12000) * 12000).toBe(MAX_EXPORT_CANVAS_SIDE);
    expect(exportScale(2, 0, 0)).toBe(2);
  });
});
