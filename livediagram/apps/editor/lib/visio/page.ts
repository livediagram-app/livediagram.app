// One Visio page as the draw.io importer's cell tree (docs/specs/020-import-export/blueprints/visio-import.md step
// 5): every shape a vertex in page pixels with the draw.io style its master (or its geometry) maps to, every
// connector an edge glued where its `Connect` rows say, pictures as embedded images. `convertPage` takes it from
// there, exactly as it takes a draw.io page.

import { MAX_ELEMENTS_PER_TAB } from '@livediagram/document';
import type { DrawioCell, DrawioGeometry, DrawioGraph, Pt } from '@/lib/drawio/cells';
import type { ReportTally } from '@/lib/drawio/notes';
import { parseStyle } from '@/lib/drawio/style';
import { inferGeometry, routePoints } from './geometry';
import { VISIO_MAX_GROUP_DEPTH, VISIO_MAX_IMAGE_BYTES, VISIO_PX_PER_INCH } from './limits';
import { masterDisplayName, masterStyle } from './master-map';
import { collectShapes, relIdOf, type VisioMaster } from './masters';
import type { VisioPackage } from './package';
import { ShapeSheet, visioColour } from './sheet';
import { shapeText, textStyle, type StylePairs } from './text';
import { applyFrame, compose, localFrame, shapeBox, type Frame } from './transform';

export type VisioPageInput = {
  /** The page part's root (`PageContents`); null for a page with no part. */
  contents: Element | null;
  /** The page part's relationships, for its pictures. */
  rels: ReadonlyMap<string, string>;
  pkg: VisioPackage;
  masters: ReadonlyMap<string, VisioMaster>;
  colours: ReadonlyMap<number, string>;
  frame: Frame;
  tally: ReportTally;
};

const ROOT_ID = '0';
const LAYER_ID = '1';
/** Visio's own default text size, 12 pt, when neither the shape nor its master sets one. */
const VISIO_DEFAULT_FONT_PX = 16;
const UNNAMED_SHAPE = 'Shape';

const RASTER_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
};

// Visio's head indexes (V4): exact ones to draw.io's markers, every other one a filled triangle, counted.
const HEADS: Readonly<Record<string, { arrow: string; fill: '0' | '1' }>> = {
  '1': { arrow: 'open', fill: '0' },
  '2': { arrow: 'open', fill: '0' },
  '3': { arrow: 'open', fill: '0' },
  '4': { arrow: 'block', fill: '1' },
  '5': { arrow: 'block', fill: '1' },
  '13': { arrow: 'block', fill: '1' },
  '20': { arrow: 'oval', fill: '1' },
  '22': { arrow: 'diamond', fill: '1' },
};

const childrenNamed = (el: Element | null | undefined, name: string) =>
  Array.from(el?.children ?? []).filter((c) => c.localName === name);

function styleString(base: string, pairs: StylePairs): string {
  const parts = base ? [base] : [];
  for (const [key, value] of Object.entries(pairs)) parts.push(`${key}=${value}`);
  return parts.join(';');
}

const px = (inches: number) => Math.round(inches * VISIO_PX_PER_INCH * 100) / 100;

/** A shape's fill, line and corner rounding as draw.io pairs; what neither it nor its master sets stays unset. */
function boxPairs(sheet: ShapeSheet, colours: ReadonlyMap<number, string>): StylePairs {
  const pairs: StylePairs = {};
  const fillTrans = sheet.num('FillForegndTrans');
  if (sheet.cell('FillPattern') === '0' || (fillTrans !== undefined && fillTrans >= 1)) {
    pairs.fillColor = 'none';
  } else {
    const fill = visioColour(sheet.cell('FillForegnd'), colours);
    if (fill) pairs.fillColor = fill;
  }
  Object.assign(pairs, linePairs(sheet, colours));
  const rounding = sheet.num('Rounding') ?? 0;
  if (rounding > 0)
    Object.assign(pairs, { rounded: '1', absoluteArcSize: '1', arcSize: String(px(rounding * 2)) });
  return pairs;
}

function linePairs(sheet: ShapeSheet, colours: ReadonlyMap<number, string>): StylePairs {
  const pairs: StylePairs = {};
  const pattern = sheet.num('LinePattern');
  if (pattern === 0) {
    pairs.strokeColor = 'none';
    return pairs;
  }
  const line = visioColour(sheet.cell('LineColor'), colours);
  if (line) pairs.strokeColor = line;
  if (pattern === 3) Object.assign(pairs, { dashed: '1', dashPattern: '1 2' });
  else if (pattern !== undefined && pattern > 1) pairs.dashed = '1';
  const weight = sheet.num('LineWeight');
  if (weight !== undefined && weight > 0) pairs.strokeWidth = String(px(weight));
  return pairs;
}

function withTextDefaults(pairs: StylePairs): StylePairs {
  return { whiteSpace: 'wrap', html: '0', fontSize: String(VISIO_DEFAULT_FONT_PX), ...pairs };
}

/** Bytes as base64, in chunks so a large picture never overflows the argument list. */
function base64Of(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let at = 0; at < bytes.length; at += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(at, at + CHUNK)));
  }
  return btoa(parts.join(''));
}

type Glue = { begin?: string; end?: string };

function readGlue(contents: Element | null): Map<string, Glue> {
  const glue = new Map<string, Glue>();
  for (const connect of childrenNamed(childrenNamed(contents, 'Connects')[0], 'Connect')) {
    const from = connect.getAttribute('FromSheet');
    const to = connect.getAttribute('ToSheet');
    const cell = connect.getAttribute('FromCell');
    if (!from || !to) continue;
    const entry = glue.get(from) ?? {};
    if (cell === 'BeginX') entry.begin = to;
    else if (cell === 'EndX') entry.end = to;
    glue.set(from, entry);
  }
  return glue;
}

type PendingEdge = { cell: DrawioCell; sheet: ShapeSheet; parent: Frame; visioId: string };

export async function visioPageGraph(input: VisioPageInput): Promise<DrawioGraph> {
  const { contents, masters, colours, tally } = input;
  const cells = new Map<string, DrawioCell>();
  const blank = (id: string, parentId: string | null): DrawioCell => ({
    id,
    parentId,
    vertex: false,
    edge: false,
    value: '',
    html: false,
    style: parseStyle('', false),
    props: [],
    visible: true,
    collapsed: false,
    children: [],
  });
  cells.set(ROOT_ID, { ...blank(ROOT_ID, null), children: [LAYER_ID] });
  const layer = blank(LAYER_ID, ROOT_ID);
  cells.set(LAYER_ID, layer);
  const graph: DrawioGraph = {
    cells,
    rootId: ROOT_ID,
    layerIds: [LAYER_ID],
    backgroundImage: false,
    gridSize: 10,
  };

  // A Visio shape id → the cell that stands for it (itself, or the mapped master or text box that consumed it).
  const aliases = new Map<string, string>();
  const edges: PendingEdge[] = [];
  let next = 0;
  let placed = 0;

  const add = (cell: Omit<DrawioCell, 'id' | 'parentId' | 'children'>): DrawioCell => {
    const full: DrawioCell = { ...cell, id: `v${(next += 1)}`, parentId: LAYER_ID, children: [] };
    cells.set(full.id, full);
    layer.children.push(full.id);
    return full;
  };

  const countSubtree = (shape: Element): number => {
    const all = new Map<string, Element>();
    collectShapes(childrenNamed(shape, 'Shapes')[0], all);
    return all.size;
  };

  const aliasSubtree = (shape: Element, cellId: string) => {
    const all = new Map<string, Element>();
    collectShapes(childrenNamed(shape, 'Shapes')[0], all);
    for (const id of all.keys()) aliases.set(id, cellId);
  };

  const vertex = (
    sheet: ShapeSheet,
    own: Frame,
    base: string,
    pairs: StylePairs,
    value: string,
  ) => {
    const box = shapeBox(own, sheet.num('Width') ?? 0, sheet.num('Height') ?? 0);
    const turned: StylePairs = { ...pairs };
    if (box.rotation !== 0) turned.rotation = String(box.rotation);
    if (sheet.cell('FlipX') === '1') turned.flipH = '1';
    if (sheet.cell('FlipY') === '1') turned.flipV = '1';
    const geometry: DrawioGeometry = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      relative: false,
      points: [],
    };
    return add({
      vertex: true,
      edge: false,
      value,
      html: false,
      style: parseStyle(styleString(base, turned), false),
      props: [],
      visible: true,
      collapsed: false,
      geometry,
    });
  };

  const textOf = (sheet: ShapeSheet) => {
    const read = shapeText(sheet);
    if (read.truncated) tally.add('text-truncated');
    return read.text;
  };

  const textBox = (sheet: ShapeSheet, own: Frame, text: string) =>
    vertex(sheet, own, 'text', withTextDefaults(textStyle(sheet, colours)), text);

  const asText = (sheet: ShapeSheet, own: Frame, text: string, name: string) => {
    tally.add('shape-as-text');
    tally.name('shape-as-text', name);
    return textBox(sheet, own, text || name);
  };

  const imageSource = async (path: string | undefined): Promise<string> => {
    const ext = path?.slice(path.lastIndexOf('.') + 1).toLowerCase() ?? '';
    const type = RASTER_TYPES[ext];
    const bytes = type && path ? await input.pkg.bytes(path, VISIO_MAX_IMAGE_BYTES) : null;
    return type && bytes ? `data:${type},${base64Of(bytes)}` : 'unavailable';
  };

  const walk = async (shapes: Element | undefined, parent: Frame, depth: number) => {
    for (const shape of childrenNamed(shapes, 'Shape')) {
      if (placed >= MAX_ELEMENTS_PER_TAB || depth > VISIO_MAX_GROUP_DEPTH) {
        tally.add('content-truncated', 1 + countSubtree(shape));
        continue;
      }
      placed += 1;
      const visioId = shape.getAttribute('ID') ?? '';
      const masterId = shape.getAttribute('Master');
      const master = masterId ? masters.get(masterId) : undefined;
      const sheet = new ShapeSheet(shape, master?.top ?? null);
      const own = compose(parent, localFrame(sheet));

      // A 1-D shape: a connector, finished once every shape it may glue to has its cell.
      if (sheet.cell('BeginX') !== undefined && sheet.cell('EndX') !== undefined) {
        const cell = add({
          vertex: false,
          edge: true,
          value: textOf(sheet),
          html: false,
          style: parseStyle('', true),
          props: [],
          visible: true,
          collapsed: false,
        });
        aliases.set(visioId, cell.id);
        edges.push({ cell, sheet, parent, visioId });
        continue;
      }

      if (shape.getAttribute('Type') === 'Foreign') {
        const relId = relIdOf(childrenNamed(shape, 'ForeignData')[0] ?? shape);
        const image = await imageSource(relId ? input.rels.get(relId) : undefined);
        const pairs = { ...linePairs(sheet, colours), image };
        aliases.set(visioId, vertex(sheet, own, 'shape=image', pairs, textOf(sheet)).id);
        continue;
      }

      const text = textOf(sheet);
      const width = sheet.num('Width') ?? 0;
      const height = sheet.num('Height') ?? 0;

      if (master) {
        const row = masterStyle(master.name);
        const cell =
          row === undefined
            ? asText(sheet, own, text, masterDisplayName(master.name) || UNNAMED_SHAPE)
            : row.style === 'text'
              ? textBox(sheet, own, text)
              : vertex(
                  sheet,
                  own,
                  row.style,
                  withTextDefaults({ ...boxPairs(sheet, colours), ...textStyle(sheet, colours) }),
                  text,
                );
        if (row?.approximated) tally.add('shape-approximated');
        aliases.set(visioId, cell.id);
        // The master's own artwork: a connector glued to a part of it lands on the whole.
        aliasSubtree(shape, cell.id);
        continue;
      }

      const kind = inferGeometry(sheet, width, height);
      const isGroup = shape.getAttribute('Type') === 'Group';
      let cellId: string | undefined;
      if (kind === 'text') {
        if (text) cellId = textBox(sheet, own, text).id;
      } else if (kind === 'other') {
        // A group's own outline that maps to nothing is dropped like a draw.io group; its sub-shapes still land.
        if (!isGroup || text) cellId = asText(sheet, own, text, UNNAMED_SHAPE).id;
      } else {
        const base = kind === 'ellipse' ? 'ellipse' : kind === 'diamond' ? 'rhombus' : '';
        const pairs = withTextDefaults({
          ...boxPairs(sheet, colours),
          ...textStyle(sheet, colours),
        });
        cellId = vertex(sheet, own, base, pairs, text).id;
      }
      if (cellId) aliases.set(visioId, cellId);
      if (isGroup) {
        if (!cellId) tally.add('group-flattened');
        await walk(childrenNamed(shape, 'Shapes')[0], own, depth + 1);
      }
    }
  };

  await walk(childrenNamed(contents, 'Shapes')[0], input.frame, 0);

  const glue = readGlue(contents);
  for (const edge of edges) finishEdge(edge, glue.get(edge.visioId) ?? {}, aliases, colours, tally);

  return graph;
}

function finishEdge(
  edge: PendingEdge,
  glue: Glue,
  aliases: ReadonlyMap<string, string>,
  colours: ReadonlyMap<number, string>,
  tally: ReportTally,
): void {
  const { sheet, parent, cell } = edge;
  const begin = applyFrame(parent, sheet.num('BeginX') ?? 0, sheet.num('BeginY') ?? 0);
  const end = applyFrame(parent, sheet.num('EndX') ?? 0, sheet.num('EndY') ?? 0);
  const own = compose(parent, localFrame(sheet));
  const route = routePoints(sheet, sheet.num('Width') ?? 0, sheet.num('Height') ?? 0);
  const points: Pt[] = route.points.slice(1, -1).map((p) => applyFrame(own, p.x, p.y));
  const source = glue.begin ? aliases.get(glue.begin) : undefined;
  const target = glue.end ? aliases.get(glue.end) : undefined;
  const pairs: StylePairs = {
    html: '0',
    ...linePairs(sheet, colours),
    ...headPairs('start', sheet.cell('BeginArrow'), tally),
    ...headPairs('end', sheet.cell('EndArrow'), tally),
    ...withTextDefaults(textStyle(sheet, colours)),
  };
  delete pairs.whiteSpace;
  if (route.curved) pairs.curved = '1';
  delete pairs.align;
  delete pairs.verticalAlign;
  cell.style = parseStyle(styleString('', pairs), true);
  if (source && source !== cell.id) cell.source = source;
  if (target && target !== cell.id) cell.target = target;
  cell.geometry = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    relative: true,
    points,
    sourcePoint: begin,
    targetPoint: end,
  };
}

function headPairs(
  side: 'start' | 'end',
  value: string | undefined,
  tally: ReportTally,
): StylePairs {
  const index = value?.trim() ?? '0';
  if (index === '' || index === '0') return { [`${side}Arrow`]: 'none' };
  const head = HEADS[index];
  if (!head) tally.add('arrowhead-approximated');
  const { arrow, fill } = head ?? { arrow: 'block', fill: '1' };
  return { [`${side}Arrow`]: arrow, [`${side}Fill`]: fill };
}
