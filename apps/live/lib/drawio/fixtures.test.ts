// @vitest-environment jsdom
// Every fixture in the corpus imports to valid elements with the report its
// content should produce (docs/specs/020-import-export/drawio-import.md).
import { describe, expect, it } from 'vitest';
import {
  isValidElement,
  isValidTab,
  type ArrowElement,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import type { ImportNote } from './notes';
import { importDrawio, type ImportedPage } from './import';
import { fixtureBytes } from './test-support';

async function load(name: string) {
  let n = 0;
  const result = await importDrawio(
    { kind: 'bytes', bytes: fixtureBytes(name) },
    { tabIdForPage: () => `tab-${++n}` },
  );
  if (!result.ok) throw new Error(result.error);
  return result;
}

const shapes = (page: ImportedPage) =>
  page.elements.filter((e): e is ShapeElement => e.type === 'shape');
const arrows = (page: ImportedPage) =>
  page.elements.filter((e): e is ArrowElement => e.type === 'arrow');
const byLabel = (page: ImportedPage, label: string) =>
  page.elements.find((e) => 'label' in e && e.label === label);

// The page scale (spec "The page scale") as one element shows it: its width over draw.io's.
const scaleOf = (page: ImportedPage, label: string, drawioWidth: number) =>
  (byLabel(page, label) as ShapeElement).width / drawioWidth;

// `expected` in draw.io units, at the page scale `k`.
function expectScaled(el: Element | undefined, expected: Record<string, number>, k: number) {
  for (const [key, v] of Object.entries(expected)) {
    expect((el as unknown as Record<string, number>)[key]).toBeCloseTo(v * k, 3);
  }
}

// Every element valid, every id unique, every pinned end on an element here.
function expectSound(page: ImportedPage) {
  expect(page.elements.filter((e) => !isValidElement(e))).toEqual([]);
  const ids = new Set(page.elements.map((e: Element) => e.id));
  expect(ids.size).toBe(page.elements.length);
  for (const a of arrows(page)) {
    for (const end of [a.from, a.to]) {
      if (end.kind === 'pinned') expect(ids.has(end.elementId)).toBe(true);
    }
  }
  expect(
    isValidTab({ id: page.tabId, name: page.name, elements: page.elements, layers: page.layers }),
  ).toBe(true);
}

const FLOWCHART_NOTES: ImportNote[] = [{ kind: 'arrowhead-approximated', count: 1 }];

describe('flowchart.drawio', () => {
  it('imports every shape and connection', async () => {
    const { pages, report } = await load('flowchart.drawio');
    const [page] = pages;
    expectSound(page!);
    expect(report).toEqual({ pages: 1, elements: 17, notes: FLOWCHART_NOTES });
    expect(page!.name).toBe('Order flow');
    // draw.io's white page is its default paper: the theme decides.
    expect(page!.backgroundColor).toBeUndefined();
    // Default colours follow the tab theme; picked colours are kept verbatim.
    const ship = byLabel(page!, 'Ship order')!;
    expect(ship).not.toHaveProperty('fillColor');
    expect(ship).not.toHaveProperty('strokeColor');
    expect(ship).not.toHaveProperty('textColor');
    expect(byLabel(page!, 'Order received')).toMatchObject({
      fillColor: '#d5e8d4',
      strokeColor: '#82b366',
    });
    expect(shapes(page!).map((s) => s.shape)).toEqual([
      'stadium',
      'square',
      'diamond',
      'square',
      'document',
      'cylinder',
      'parallelogram',
      'circle',
    ]);
    expect(arrows(page!)).toHaveLength(8);
    expect(byLabel(page!, 'Validate payment')).toMatchObject({
      fillColor: '#dae8fc',
      strokeColor: '#6c8ebf',
      borderRadius: 'sm',
      textColor: '#1e293b',
      richText: [{ text: 'Validate ' }, { text: 'payment', bold: true }],
    });
    expect(byLabel(page!, 'Payments settle within\ntwo working days.')).toMatchObject({
      type: 'text',
      textItalic: true,
      textColor: '#666666',
    });
    // draw.io routes "No" level from the decision's tip into the retry shape: a straight line,
    // however its router is named.
    const no = arrows(page!).find((a) => a.label === 'No')!;
    expect(no.arrowStyle).toBeUndefined();
    expect(no).toMatchObject({
      from: { kind: 'pinned', anchor: 'w' },
      to: { kind: 'pinned', anchor: 'e' },
      labelOffset: { t: 0.4, offset: 0 },
    });
    // The loop back runs through its two waypoints with right-angle corners.
    const back = arrows(page!).at(-1)!;
    expect(back).toMatchObject({ arrowStyle: 'angled', to: { anchor: 's' } });
    expect(back.curvePoints).toHaveLength(2);
    const both = arrows(page!).find((a) => a.arrowEnds === 'both')!;
    // One head shape per arrow: the end's (block, the default triangle).
    expect(both.arrowheadShape).toBeUndefined();
  });

  it('decodes the compressed, bare, and PNG forms to the same diagram', async () => {
    for (const name of [
      'flowchart.compressed.drawio',
      'flowchart.mxgraphmodel.xml',
      'flowchart.drawio.png',
    ]) {
      const { pages, report } = await load(name);
      expectSound(pages[0]!);
      expect(report.elements).toBe(17);
      expect(report.notes).toEqual(FLOWCHART_NOTES);
    }
  });
});

describe('swimlanes.drawio', () => {
  it('imports the pool and lanes as lanes, the steps inside them', async () => {
    for (const name of ['swimlanes.drawio', 'swimlanes.drawio.png']) {
      const { pages, report } = await load(name);
      const page = pages[0]!;
      expectSound(page);
      // The pool and its three lanes keep their titles upright in thin strips; nothing to report.
      expect(report).toMatchObject({ elements: 17, notes: [] });
      const k = scaleOf(page, 'Apply', 120);
      for (const title of ['Candidate', 'Recruiter', 'Team']) {
        expect(byLabel(page, title)).toMatchObject({ titleOrientation: 'upright' });
        expectScaled(byLabel(page, title), { x: 60, width: 740, headerSize: 20 }, k);
      }
      expect(byLabel(page, 'Hiring')).toMatchObject({ titleOrientation: 'upright' });
      expectScaled(byLabel(page, 'Hiring'), { x: 40, width: 760, headerSize: 20 }, k);
      expectScaled(byLabel(page, 'Apply'), { x: 120 }, k);
      const lanes = shapes(page).filter((s) => s.shape === 'lane');
      expect(lanes.map((l) => l.label)).toEqual([
        'Hiring',
        'Candidate',
        'Recruiter',
        'Team',
        'Sprint board',
      ]);
      // Its near-white body (#f5f9ff) is paper: it takes the theme's surface.
      expect(byLabel(page, 'Candidate')).not.toHaveProperty('fillColor');
      expectScaled(byLabel(page, 'Candidate'), { y: 40 }, k);
      expect(byLabel(page, 'Candidate')).toMatchObject({
        headerFill: '#dae8fc',
        textColor: '#1e293b',
        textAlignX: 'left',
      });
      expectScaled(byLabel(page, 'Sprint board'), { headerSize: 30 }, k);
      expect(byLabel(page, 'Sprint board')).toMatchObject({
        textAlignX: 'center',
        textAlignY: 'top',
        fillColor: 'transparent',
      });
      // A step inside a lane inside the pool lands at its canvas position.
      expectScaled(byLabel(page, 'Interview'), { x: 280, y: 360 }, k);
    }
  });
});

describe('uml.drawio', () => {
  it('imports class boxes as entities, the ER table as a table', async () => {
    const { pages, report } = await load('uml.drawio');
    const page = pages[0]!;
    expectSound(page);
    expect(report).toEqual({
      pages: 1,
      elements: 13,
      notes: [
        { kind: 'shape-approximated', count: 2 },
        { kind: 'arrowhead-approximated', count: 1 },
      ],
    });
    // The actor's name sits under the figure, as in draw.io: the box grows to hold it.
    const shopper = byLabel(page, 'Shopper') as ShapeElement;
    expect(shopper).toMatchObject({ shape: 'actor', textAlignY: 'bottom' });
    // Grown a line down and widened about its centre to hold the name on one line.
    const k = shopper.height / 78;
    expect(shopper.y).toBeCloseTo(320 * k, 3);
    expect(shopper.x + shopper.width / 2).toBeCloseTo(735 * k, 3);
    expect(shopper.width).toBeGreaterThan(30 * k);
    expect(byLabel(page, 'Order')).toMatchObject({
      shape: 'entity',
      entityFields: [
        { name: '+ id', type: 'UUID' },
        { name: '+ total', type: 'Money' },
        { name: '+ place()', type: 'void' },
        { name: '+ cancel(reason: String)', type: 'void' },
      ],
    });
    const table = page.elements.find((e) => e.type === 'table')!;
    expectScaled(table, { y: 110 }, k);
    expect((table as { colWidths: number[] }).colWidths.map((w) => w / k)).toEqual([
      expect.closeTo(30, 3),
      expect.closeTo(150, 3),
    ]);
    expect((table as { rowHeights: number[] }).rowHeights.map((h) => h / k)).toEqual([
      expect.closeTo(30, 3),
      expect.closeTo(30, 3),
      expect.closeTo(30, 3),
    ]);
    expect(table).toMatchObject({
      cells: [
        ['PK', 'id'],
        ['', 'email'],
        ['', 'name'],
      ],
    });
    expect(byLabel(page, 'customers')).toMatchObject({ type: 'text', textBold: true });
    const inherit = arrows(page).find((a) => a.arrowheadShape === 'triangle-hollow')!;
    const order = byLabel(page, 'Order')!;
    expect(inherit.to).toMatchObject({ kind: 'pinned', elementId: order.id });
    const compose = arrows(page).find((a) => a.label === 'contains')!;
    expect(compose).toMatchObject({ arrowEnds: 'from', arrowheadShape: 'diamond' });
    expect(compose.to).toMatchObject({ elementId: byLabel(page, 'LineItem')!.id });
    const places = arrows(page).find((a) => a.label === 'places')!;
    expect(places.from).toMatchObject({ elementId: table.id });
    expect(places.to).toMatchObject({ elementId: order.id });
    expect(byLabel(page, 'Totals include VAT.')).toMatchObject({
      type: 'sticky',
      fillColor: '#fff2cc',
    });
    expect(byLabel(page, 'checkout')).toMatchObject({ shape: 'frame' });
  });
});

describe('cloud-architecture.drawio', () => {
  it('maps vendor stencils to icons and names what it cannot match', async () => {
    for (const name of ['cloud-architecture.drawio', 'cloud-architecture.drawio.svg']) {
      const { pages, report, images } = await load(name);
      const page = pages[0]!;
      expectSound(page);
      expect(report).toEqual({
        pages: 1,
        // The team logo's name, drawn under it, comes in as its caption.
        elements: 21,
        notes: [
          {
            kind: 'shape-unmatched',
            count: 3,
            names: [
              { name: 'router', count: 2 },
              { name: 'workgroup switch', count: 1 },
            ],
          },
          { kind: 'shape-approximated', count: 1 },
          { kind: 'icon-substituted', count: 7 },
          { kind: 'image-unavailable', count: 1 },
          { kind: 'label-moved', count: 2 },
        ],
      });
      expect(
        shapes(page)
          .filter((s) => s.shape === 'icon')
          .map((s) => s.iconId),
      ).toEqual([
        'aws-apigateway',
        'aws-lambda',
        'aws-dynamodb',
        'aws-s3',
        'azure-vm',
        'k8s',
        'server',
      ]);
      expect(byLabel(page, 'Production VPC')).toMatchObject({
        shape: 'frame',
        textAlignX: 'left',
        textAlignY: 'top',
      });
      expect(byLabel(page, 'Pod')).toMatchObject({ iconId: 'k8s' });
      expect(byLabel(page, 'router')).toMatchObject({ shape: 'square' });
      // An icon's caption below it grows its box, down and (about its centre)
      // across to hold the line; the vendor's caption colour stays behind.
      const fn = byLabel(page, 'Orders function')!;
      expect(fn).toMatchObject({ textAlignY: 'bottom' });
      const k = (fn as ShapeElement).height / 96;
      expectScaled(fn, { y: 120 }, k);
      expect((fn as ShapeElement).x + (fn as ShapeElement).width / 2).toBeCloseTo(459 * k, 3);
      expect((fn as ShapeElement).width).toBeGreaterThan(78 * k);
      expect(fn).not.toHaveProperty('textColor');
      const logo = page.elements.find((e) => e.type === 'image' && e.alt === 'Team logo')!;
      expect(logo).toMatchObject({ imageId: null });
      expect(byLabel(page, 'Team logo')).toMatchObject({ type: 'text', textAlignX: 'center' });
      expect(images).toEqual([
        {
          elementId: logo.id,
          key: 'drawio-image-1',
          source: {
            kind: 'data-url',
            dataUrl:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          },
          hint: { width: 80 * k, height: 80 * k },
        },
      ]);
    }
  });
});

describe('multi-page.drawio', () => {
  it('imports each page, with layers, links and the report', async () => {
    for (const name of ['multi-page.drawio', 'multi-page.compressed.drawio']) {
      const { pages, report } = await load(name);
      pages.forEach(expectSound);
      expect(pages.map((p) => [p.tabId, p.name, p.elements.length])).toEqual([
        ['tab-1', 'Overview', 9],
        ['tab-2', 'Detail', 8],
        ['tab-3', 'Scratch', 0],
      ]);
      expect(report).toEqual({
        pages: 3,
        elements: 17,
        notes: [
          { kind: 'shape-approximated', count: 2 },
          { kind: 'connection-loosened', count: 1 },
          { kind: 'group-flattened', count: 1 },
          { kind: 'hidden-skipped', count: 1 },
          { kind: 'collapsed-skipped', count: 1 },
          { kind: 'link-dropped', count: 1 },
        ],
      });
      const [overview, detail] = pages as [ImportedPage, ImportedPage];
      expect(overview.backgroundColor).toBe('#fafaf5');
      expect(overview.layers).toEqual([
        { id: 'layer:default', name: 'Layer 1' },
        { id: expect.stringMatching(/^layer:/), name: 'Annotations', visible: false, locked: true },
      ]);
      expect(byLabel(overview, 'Remember to review the fold.')).toMatchObject({
        layerId: overview.layers![1]!.id,
      });
      expect(byLabel(overview, "Platform team's board")).toMatchObject({
        link: { kind: 'tab', tabId: 'tab-2' },
        note: 'Start here\nowner: Platform team',
        shadow: { offsetX: 2, offsetY: 3, blur: 3, opacity: 0.25 },
        layerId: 'layer:default',
      });
      expect(byLabel(overview, 'Docs')).toMatchObject({
        shape: 'hexagon',
        link: { kind: 'url', url: 'https://example.com/docs' },
      });
      expect(byLabel(overview, 'Run')).not.toHaveProperty('link');
      expectScaled(
        byLabel(overview, 'Grouped B'),
        { x: 220, y: 160 },
        scaleOf(overview, 'Grouped B', 120),
      );
      expect(byLabel(overview, 'Folded box')).toMatchObject({ shape: 'lane' });
      expectScaled(
        byLabel(overview, 'Folded box'),
        { height: 23 },
        scaleOf(overview, 'Grouped B', 120),
      );
      expect(byLabel(overview, 'Hidden draft')).toBeUndefined();
      expect(
        byLabel(detail, 'Release plan\n• Beta in May\n• GA in June\nSee the plan'),
      ).toMatchObject({ shape: 'square', textAlignX: 'left', textAlignY: 'top' });
      const tri = shapes(detail).find((s) => s.shape === 'triangle')!;
      expect(tri).toMatchObject({ rotation: 90 });
      expectScaled(tri, { x: 330, y: 50, width: 80 }, tri.height / 60);
      expect(byLabel(detail, 'Subroutine')).toMatchObject({ rotation: 15, opacity: 0.6 });
      expect(byLabel(detail, 'Big and bold')).toMatchObject({
        type: 'text',
        textSize: 'lg',
        textBold: true,
        font: 'roboto-mono',
      });
    }
  });
});

describe('refusals', () => {
  it('explains a PNG without a diagram', async () => {
    const result = await importDrawio(
      { kind: 'bytes', bytes: fixtureBytes('no-diagram.png') },
      { tabIdForPage: () => 't' },
    );
    expect(result).toEqual({
      ok: false,
      error:
        "This PNG has no draw.io diagram inside. In draw.io, export as PNG with 'Include a copy of my diagram' ticked.",
    });
  });

  it('refuses a file over the size limit before reading it', async () => {
    const result = await importDrawio(
      { kind: 'bytes', bytes: new Uint8Array(50 * 1024 * 1024 + 1) },
      { tabIdForPage: () => 't' },
    );
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('too large') });
  });
});
