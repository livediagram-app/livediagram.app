// Test helpers for the Visio importer (never shipped): a .vsdx built in code from page and master XML, so the
// repo carries no binary fixtures. Node only (the zip writer uses node:zlib).

import { writeZip } from '@/lib/zip-writer-fixture';

const NS =
  'xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL_NS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';

export type FixturePage = {
  name?: string;
  height?: number;
  shapes: string;
  connects?: string;
  background?: boolean;
};
export type FixtureMaster = { id: string; name: string; shapes?: string };
export type FixtureMedia = { name: string; data: Uint8Array | string };

type VsdxInput = {
  pages: FixturePage[];
  masters?: FixtureMaster[];
  colours?: string;
  media?: FixtureMedia[];
  /** Page index to its extra relationships (`Id` to `Target`). */
  pageRels?: Record<number, Record<string, string>>;
  method?: 'stored' | 'deflate';
};

const rel = (id: string, target: string) =>
  `<Relationship Id="${id}" Type="t" Target="${target}"/>`;

/** One `<Cell N V/>` per entry. */
export const cells = (values: Record<string, string | number>) =>
  Object.entries(values)
    .map(([n, v]) => `<Cell N="${n}" V="${v}"/>`)
    .join('');

/** A 2-D shape: pin at its centre, the given cells, optional master and inner XML. */
export function shape(
  id: number | string,
  box: { x: number; y: number; w: number; h: number },
  opts: {
    master?: string;
    type?: string;
    text?: string;
    cells?: Record<string, string | number>;
    inner?: string;
    masterShape?: string;
  } = {},
): string {
  const attrs = [
    `ID="${id}"`,
    opts.type ? `Type="${opts.type}"` : 'Type="Shape"',
    opts.master ? `Master="${opts.master}"` : '',
    opts.masterShape ? `MasterShape="${opts.masterShape}"` : '',
  ].join(' ');
  const geometry = cells({
    PinX: box.x,
    PinY: box.y,
    Width: box.w,
    Height: box.h,
    LocPinX: box.w / 2,
    LocPinY: box.h / 2,
    ...opts.cells,
  });
  const text = opts.text !== undefined ? `<Text>${opts.text}</Text>` : '';
  return `<Shape ${attrs}>${geometry}${opts.inner ?? ''}${text}</Shape>`;
}

/** A rectangle's geometry section in the shape's own inches. */
export const rectGeometry = (w: number, h: number) =>
  `<Section N="Geometry" IX="0"><Row T="MoveTo" IX="1">${cells({ X: 0, Y: 0 })}</Row><Row T="LineTo" IX="2">${cells({ X: w, Y: 0 })}</Row><Row T="LineTo" IX="3">${cells({ X: w, Y: h })}</Row><Row T="LineTo" IX="4">${cells({ X: 0, Y: h })}</Row><Row T="LineTo" IX="5">${cells({ X: 0, Y: 0 })}</Row></Section>`;

/** A 1-D connector from (bx, by) to (ex, ey) through `via` (page inches), its geometry in its own frame. */
export function connector(
  id: number | string,
  begin: { x: number; y: number },
  end: { x: number; y: number },
  opts: {
    via?: { x: number; y: number }[];
    cells?: Record<string, string | number>;
    text?: string;
    master?: string;
    rowType?: string;
  } = {},
): string {
  const all = [begin, ...(opts.via ?? []), end];
  const minX = Math.min(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const w = Math.max(...all.map((p) => p.x)) - minX;
  const h = Math.max(...all.map((p) => p.y)) - minY;
  const rows = all
    .map(
      (p, i) =>
        `<Row T="${i === 0 ? 'MoveTo' : i === all.length - 1 && opts.rowType ? opts.rowType : 'LineTo'}" IX="${i + 1}">${cells({ X: p.x - minX, Y: p.y - minY })}</Row>`,
    )
    .join('');
  const text = opts.text !== undefined ? `<Text>${opts.text}</Text>` : '';
  return `<Shape ID="${id}" Type="Shape"${opts.master ? ` Master="${opts.master}"` : ''}>${cells({
    PinX: minX + w / 2,
    PinY: minY + h / 2,
    Width: w,
    Height: h,
    LocPinX: w / 2,
    LocPinY: h / 2,
    BeginX: begin.x,
    BeginY: begin.y,
    EndX: end.x,
    EndY: end.y,
    ...opts.cells,
  })}<Section N="Geometry" IX="0">${rows}</Section>${text}</Shape>`;
}

export const glue = (connectorId: number | string, end: 'BeginX' | 'EndX', toId: number | string) =>
  `<Connect FromSheet="${connectorId}" FromCell="${end}" ToSheet="${toId}" ToCell="PinX"/>`;

/** A .vsdx's bytes. */
export function vsdx(input: VsdxInput): Uint8Array<ArrayBuffer> {
  const method = input.method ?? 'deflate';
  const files: { name: string; data: Uint8Array | string; method?: 'stored' | 'deflate' }[] = [];
  const pageEntries = input.pages
    .map(
      (p, i) =>
        `<Page ID="${i}" ${p.name !== undefined ? `Name="${p.name}"` : ''}${p.background ? ' Background="1"' : ''}><PageSheet>${cells({ PageHeight: p.height ?? 11, PageWidth: 8.5 })}</PageSheet><Rel r:id="rId${i + 1}"/></Page>`,
    )
    .join('');
  files.push({
    name: 'visio/pages/pages.xml',
    data: `<?xml version="1.0"?><Pages ${NS}>${pageEntries}</Pages>`,
    method,
  });
  files.push({
    name: 'visio/pages/_rels/pages.xml.rels',
    data: `<Relationships ${REL_NS}>${input.pages.map((_, i) => rel(`rId${i + 1}`, `page${i + 1}.xml`)).join('')}</Relationships>`,
    method,
  });
  input.pages.forEach((p, i) => {
    files.push({
      name: `visio/pages/page${i + 1}.xml`,
      data: `<PageContents ${NS}><Shapes>${p.shapes}</Shapes>${p.connects ? `<Connects>${p.connects}</Connects>` : ''}</PageContents>`,
      method,
    });
    const extra = input.pageRels?.[i];
    if (extra) {
      files.push({
        name: `visio/pages/_rels/page${i + 1}.xml.rels`,
        data: `<Relationships ${REL_NS}>${Object.entries(extra)
          .map(([id, t]) => rel(id, t))
          .join('')}</Relationships>`,
        method,
      });
    }
  });
  if (input.masters) {
    files.push({
      name: 'visio/masters/masters.xml',
      data: `<Masters ${NS}>${input.masters.map((m, i) => `<Master ID="${m.id}" NameU="${m.name}" Name="${m.name}"><Rel r:id="rId${i + 1}"/></Master>`).join('')}</Masters>`,
      method,
    });
    files.push({
      name: 'visio/masters/_rels/masters.xml.rels',
      data: `<Relationships ${REL_NS}>${input.masters.map((_, i) => rel(`rId${i + 1}`, `master${i + 1}.xml`)).join('')}</Relationships>`,
      method,
    });
    input.masters.forEach((m, i) => {
      files.push({
        name: `visio/masters/master${i + 1}.xml`,
        data: `<MasterContents ${NS}><Shapes>${m.shapes ?? `<Shape ID="5" Type="Shape">${cells({ Width: 1, Height: 1 })}</Shape>`}</Shapes></MasterContents>`,
        method,
      });
    });
  }
  if (input.colours) {
    files.push({
      name: 'visio/document.xml',
      data: `<VisioDocument ${NS}><Colors>${input.colours}</Colors></VisioDocument>`,
      method,
    });
  }
  for (const m of input.media ?? [])
    files.push({ name: `visio/media/${m.name}`, data: m.data, method: 'stored' });
  return writeZip(files);
}

/** One page of shapes, no masters. */
export const onePage = (shapes: string, connects?: string, extra: Partial<VsdxInput> = {}) =>
  vsdx({ pages: [{ name: 'Page-1', shapes, ...(connects ? { connects } : {}) }], ...extra });
