// Test-only encoder for Microsoft Whiteboard board exports: readable descriptions in, the files a
// board export holds out. It mirrors the decoder (values.ts, pen-stroke.ts, replay.ts) so the tests
// document the format; no real export is ever committed.
import { MSWB_COMMAND, MSWB_COMMAND_TRAIT, MSWB_TRAIT, MSWB_TYPE } from './format';
import { STROKE_EXT, STROKE_FLAG } from './pen-stroke';

// ---- values ---------------------------------------------------------------------------------

export function encodeVarint(value: number): number[] {
  const out: number[] = [];
  let v = value;
  do {
    let b = v % 128;
    v = Math.floor(v / 128);
    if (v > 0) b |= 0x80;
    out.push(b);
  } while (v > 0);
  return out;
}

export const encodeZigzag = (v: number): number => (v >= 0 ? v * 2 : -v * 2 - 1);

export function encodePackedDouble(value: number): number[] {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
  const out = [Number(bits >> 56n)];
  const groups: number[] = [];
  for (let shift = 49n; shift >= 0n; shift -= 7n) groups.push(Number((bits >> shift) & 0x7fn));
  while (groups.length > 1 && groups[groups.length - 1] === 0) groups.pop();
  groups.forEach((g, i) => out.push(i < groups.length - 1 ? g | 0x80 : g));
  return out;
}

const hexBytes = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** 01 then the zig-zag varint of B G R A as a signed 32-bit number. */
export function encodePenColour(hex: string, alpha = 1): Uint8Array {
  const [r, g, b] = hexBytes(hex) as [number, number, number];
  const a = Math.round(alpha * 255);
  const signed = (b << 24) | (g << 16) | (r << 8) | a | 0;
  return Uint8Array.from([1, ...encodeVarint(encodeZigzag(signed))]);
}

export function encodeArgb(hex: string, alpha = 1): Uint8Array {
  return Uint8Array.from([Math.round(alpha * 255), ...hexBytes(hex)]);
}

export function encodeNumber(value: number, length: 1 | 2 | 4 | 8 = 8): Uint8Array {
  const view = new DataView(new ArrayBuffer(length));
  if (length === 1) view.setInt8(0, value);
  else if (length === 2) view.setInt16(0, value, true);
  else if (length === 4) view.setInt32(0, value, true);
  else view.setFloat64(0, value, true);
  return new Uint8Array(view.buffer);
}

// ---- pen strokes ----------------------------------------------------------------------------

/**
 * The stroke layouts real boards hold: `current` (x, y, timing, pressure at 1/128 px),
 * `older` (x, y, pressure and two extension channels at HIMETRIC), `olderPlain` (x, y, pressure),
 * `olderTimed` (x, y, timing, pressure and two extension channels).
 */
export type StrokeLayout = 'current' | 'older' | 'olderPlain' | 'olderTimed';

export type StrokeDescription = {
  layout?: StrokeLayout;
  unitScale?: number;
  /** In stored units. */
  width: number;
  /** In stored units; p 0 to 1. */
  points: { x: number; y: number; p?: number }[];
  /** Extension header values (older layouts with extension bits 0x02 and 0x04). */
  extraHeaders?: boolean;
};

export const CURRENT_UNIT_SCALE = 1 / 128;
export const OLDER_UNIT_SCALE = 1 / 26.458333333333332;

export function encodePenStroke(d: StrokeDescription): Uint8Array {
  const layout = d.layout ?? 'current';
  const pressureMax = layout === 'olderTimed' ? 1024 : 8192;
  let flags = STROKE_FLAG.unitScale | STROKE_FLAG.pressure | 0x40;
  let ext = 0;
  if (layout === 'current')
    flags |= STROKE_FLAG.origin | STROKE_FLAG.extraDouble | STROKE_FLAG.timing;
  if (layout === 'older' || layout === 'olderTimed') {
    flags |= STROKE_FLAG.extension;
    ext = STROKE_EXT.channelA | STROKE_EXT.channelB;
    if (d.extraHeaders) ext |= STROKE_EXT.threeHeaderValues | STROKE_EXT.oneHeaderValue;
  }
  if (layout === 'olderTimed') flags |= STROKE_FLAG.timing;
  const unitScale = d.unitScale ?? (layout === 'current' ? CURRENT_UNIT_SCALE : OLDER_UNIT_SCALE);
  const out: number[] = [flags];
  if (flags & STROKE_FLAG.extension) out.push(ext);
  if (flags & STROKE_FLAG.origin) out.push(...encodePackedDouble(0), ...encodePackedDouble(0));
  out.push(...encodePackedDouble(unitScale));
  if (flags & STROKE_FLAG.extraDouble) out.push(...encodePackedDouble(0));
  out.push(...encodeVarint(pressureMax), ...encodeVarint(d.width));
  if (ext & STROKE_EXT.channelA) out.push(...encodeVarint(90));
  if (ext & STROKE_EXT.channelB) out.push(...encodeVarint(360));
  if (ext & STROKE_EXT.threeHeaderValues)
    out.push(...encodeVarint(11), ...encodeVarint(22), ...encodeVarint(33));
  if (ext & STROKE_EXT.oneHeaderValue) out.push(...encodeVarint(44));
  let px = 0;
  let py = 0;
  d.points.forEach((pt, i) => {
    out.push(...encodeVarint(encodeZigzag(pt.x - px)), ...encodeVarint(encodeZigzag(pt.y - py)));
    px = pt.x;
    py = pt.y;
    if (flags & STROKE_FLAG.timing) out.push(...encodeVarint(encodeZigzag(i === 0 ? 1000 : 1)));
    out.push(...encodeVarint(Math.round((pt.p ?? 0.5) * pressureMax)));
    if (ext & STROKE_EXT.channelA) out.push(...encodeVarint(i === 0 ? 90 : 0));
    if (ext & STROKE_EXT.channelB) out.push(...encodeVarint(i === 0 ? 360 : 0));
  });
  return Uint8Array.from(out);
}

// ---- tree nodes -----------------------------------------------------------------------------

export type RawNode = {
  nrefIsa: string;
  fuid?: string;
  payload?: string | null;
  traits: { trait: string; children: RawNode[] }[];
};

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

let nextId = 0;
/** A fresh node id in Whiteboard's `<session>-<counter>` shape. */
export const freshId = () => `00000000-0000-4000-8000-000000000000-${(++nextId).toString(16)}`;

export function node(
  type: string,
  traits: Record<string, RawNode[]> = {},
  payload?: Uint8Array,
  id: string | null = freshId(),
): RawNode {
  return {
    nrefIsa: type,
    ...(id ? { fuid: id } : {}),
    ...(payload ? { payload: toBase64(payload) } : {}),
    traits: Object.entries(traits).map(([trait, children]) => ({ trait, children })),
  };
}

export const num = (v: number, length: 1 | 2 | 4 | 8 = 8) =>
  node(MSWB_TYPE.number, {}, encodeNumber(v, length));
export const point = (x: number, y: number) =>
  node(MSWB_TYPE.point, { [MSWB_TRAIT.children]: [num(x), num(y)] });
export const size = (w: number, h: number) =>
  node(MSWB_TYPE.size, { [MSWB_TRAIT.children]: [num(w), num(h)] });
export const argb = (hex: string, alpha = 1) => node(MSWB_TYPE.argb, {}, encodeArgb(hex, alpha));
export const enumValue = (type: string) => node(type);

/** A text body: paragraphs of one run each. */
export const textBody = (paragraphs: string[]) =>
  paragraphs.map((p) =>
    node(MSWB_TYPE.paragraph, {
      [MSWB_TRAIT.children]: [
        node(MSWB_TYPE.run, {
          [MSWB_TRAIT.children]: [
            node(MSWB_TYPE.string, {}, p ? new TextEncoder().encode(p) : undefined),
          ],
        }),
      ],
    }),
  );

// ---- elements -------------------------------------------------------------------------------

export type StrokeNodeDescription = {
  preset?: 'pen' | 'highlighter' | 'highlighterOld' | 'rainbow' | 'galaxy';
  colour?: string;
  alpha?: number;
  stroke: StrokeDescription;
  widthFactor?: number;
  translate?: [number, number];
  arrowhead?: boolean;
};

export function strokeNode(d: StrokeNodeDescription): RawNode {
  const preset = d.preset ?? 'pen';
  const traits: Record<string, RawNode[]> = {};
  if (d.colour)
    traits[MSWB_TRAIT.penColour] = [
      node(MSWB_TYPE.penColour, {}, encodePenColour(d.colour, d.alpha)),
    ];
  if (d.widthFactor !== undefined)
    traits[MSWB_TRAIT.widthFactor] = [
      node(MSWB_TYPE.widthFactor, {}, Uint8Array.from([1, ...encodePackedDouble(d.widthFactor)])),
    ];
  if (d.translate)
    traits[MSWB_TRAIT.strokeTransform] = [
      node(
        MSWB_TYPE.strokeTransform,
        {},
        Uint8Array.from([
          7,
          ...encodePackedDouble(d.translate[0]),
          ...encodePackedDouble(d.translate[1]),
          ...encodePackedDouble(-0),
          ...encodePackedDouble(1),
        ]),
      ),
    ];
  // The arrowhead's own geometry is not decoded; its presence is what the import reads.
  if (d.arrowhead)
    traits[MSWB_TRAIT.arrowhead] = [
      node(MSWB_TYPE.arrowhead, {}, Uint8Array.from([0xff, 0x06, 0, 0])),
    ];
  return node(MSWB_TYPE[preset], traits, encodePenStroke(d.stroke));
}

export type Box = { x: number; y: number; scale?: number; rotation?: number };

const placement = (b: Box) => ({
  [MSWB_TRAIT.position]: [point(b.x, b.y)],
  ...(b.scale !== undefined ? { [MSWB_TRAIT.scale]: [num(b.scale)] } : {}),
  ...(b.rotation !== undefined ? { [MSWB_TRAIT.rotation]: [num(b.rotation)] } : {}),
});

export const inkGroup = (b: Box & { strokes: StrokeNodeDescription[] }) =>
  node(MSWB_TYPE.inkGroup, { ...placement(b), [MSWB_TRAIT.strokes]: b.strokes.map(strokeNode) });

type TextStyle = { fontSize?: number; bold?: boolean };
const textTraits = (paragraphs: string[] | undefined, style: TextStyle) => ({
  ...(paragraphs ? { [MSWB_TRAIT.children]: textBody(paragraphs) } : {}),
  [MSWB_TRAIT.fontSize]: [num(style.fontSize ?? 24)],
  [MSWB_TRAIT.weight]: [
    enumValue(style.bold ? MSWB_TYPE.bold : 'a9ce3216-1aba-47c2-ad3a-62e58e8e638a'),
  ],
});

export const shapeNode = (
  b: Box & {
    w: number;
    h: number;
    border?: string;
    fill?: string;
    borderWidth?: number;
    dashed?: boolean;
    text?: string[];
  } & TextStyle,
) =>
  node(MSWB_TYPE.shape, {
    ...placement(b),
    [MSWB_TRAIT.size]: [size(b.w, b.h)],
    [MSWB_TRAIT.borderWidth]: [num(b.borderWidth ?? 2)],
    [MSWB_TRAIT.dash]: [num(b.dashed ? 2 : 0)],
    ...(b.border ? { [MSWB_TRAIT.border]: [argb(b.border)] } : {}),
    ...(b.fill ? { [MSWB_TRAIT.fill]: [argb(b.fill)] } : {}),
    ...textTraits(b.text, b),
  });

export const stickyNode = (b: Box & { w: number; h: number; text?: string[] } & TextStyle) =>
  node(MSWB_TYPE.sticky, {
    ...placement(b),
    [MSWB_TRAIT.size]: [size(b.w, b.h)],
    [MSWB_TRAIT.stickyColour]: [enumValue('5dfbbf5b-19c8-5aeb-b621-018af0bddaaa')],
    ...textTraits(b.text, b),
  });

export const textBoxNode = (
  b: Box & { w?: number; h?: number; colour?: string; text: string[] } & TextStyle,
) =>
  node(MSWB_TYPE.textBox, {
    ...placement(b),
    [MSWB_TRAIT.size]: [b.w !== undefined ? size(b.w, b.h ?? 0) : node(MSWB_TYPE.size)],
    ...(b.colour ? { [MSWB_TRAIT.textColour]: [enumValue(b.colour)] } : {}),
    ...textTraits(b.text, b),
  });

export const imageNode = (b: Box & { w: number; h: number; dataId: string }) =>
  node(MSWB_TYPE.image, {
    ...placement(b),
    [MSWB_TRAIT.size]: [size(b.w, b.h)],
    [MSWB_TRAIT.children]: [node(MSWB_TYPE.imageData, {}, undefined, b.dataId)],
  });

export const polygonNode = (b: {
  cx: number;
  cy: number;
  corners: [number, number][];
  colour?: string;
}) =>
  node(MSWB_TYPE.polygon, {
    [MSWB_TRAIT.position]: [point(b.cx, b.cy)],
    [MSWB_TRAIT.corners]: b.corners.map(([x, y]) =>
      node(MSWB_TYPE.polygonCorner, { [MSWB_TRAIT.cornerPoint]: [point(x, y)] }),
    ),
    ...(b.colour ? { [MSWB_TRAIT.polygonColour]: [argb(b.colour)] } : {}),
  });

export const lineNode = (
  b: Box & {
    from: [number, number];
    to: [number, number];
    width?: number;
    dashed?: boolean;
    colour?: string;
    startHead?: number;
    endHead?: number;
  },
) =>
  node(MSWB_TYPE.line, {
    ...placement(b),
    [MSWB_TRAIT.borderWidth]: [num(b.width ?? 2)],
    [MSWB_TRAIT.dash]: [num(b.dashed ? 2 : 0)],
    ...(b.colour ? { [MSWB_TRAIT.border]: [argb(b.colour)] } : {}),
    [MSWB_TRAIT.lineFrom]: [point(...b.from)],
    [MSWB_TRAIT.lineTo]: [point(...b.to)],
    [MSWB_TRAIT.lineStartHead]: [num(b.startHead ?? 0)],
    [MSWB_TRAIT.lineEndHead]: [num(b.endHead ?? 0)],
  });

export const tableNode = (
  b: Box & { rows: { height: number; cells: RawNode[][] }[]; columns: number[]; colour?: string },
) =>
  node(MSWB_TYPE.table, {
    ...placement(b),
    [MSWB_TRAIT.tableRows]: b.rows.map((r) =>
      node(MSWB_TYPE.tableRow, {
        [MSWB_TRAIT.tableExtent]: [num(r.height)],
        [MSWB_TRAIT.tableCells]: r.cells.map((content) =>
          node(MSWB_TYPE.tableCell, { [MSWB_TRAIT.tableCellContent]: content }),
        ),
      }),
    ),
    [MSWB_TRAIT.tableColumns]: b.columns.map((w) =>
      node(MSWB_TYPE.tableColumn, { [MSWB_TRAIT.tableExtent]: [num(w)] }),
    ),
    ...(b.colour ? { [MSWB_TRAIT.tableColour]: [argb(b.colour)] } : {}),
  });

// ---- changes --------------------------------------------------------------------------------

export type RawChange = {
  type: string;
  fuid: string;
  changeOrder: number;
  compression: 0;
  gch: Record<string, unknown> & { dtu: string };
  deferred?: { id: string; fuid: string; type: string }[];
};

const ref = (id: string) => node('c6187257-f333-5d68-ae73-72ae40df8518', {}, undefined, id);
const traitName = (trait: string) => node(trait, {}, undefined, null);

/** Group commands, as a group change carries them. */
export const command = {
  insert: (parent: string, trait: string, nodes: RawNode[], after?: string) =>
    node(
      MSWB_COMMAND.insert,
      {
        [MSWB_COMMAND_TRAIT.parent]: [ref(parent)],
        [MSWB_COMMAND_TRAIT.trait]: [traitName(trait)],
        ...(after ? { [MSWB_COMMAND_TRAIT.afterSibling]: [ref(after)] } : {}),
        [MSWB_COMMAND_TRAIT.content]: nodes,
      },
      undefined,
      null,
    ),
  remove: (parent: string, trait: string, first: string, last = first) =>
    node(
      MSWB_COMMAND.delete,
      {
        [MSWB_COMMAND_TRAIT.parent]: [ref(parent)],
        [MSWB_COMMAND_TRAIT.trait]: [traitName(trait)],
        [MSWB_COMMAND_TRAIT.first]: [ref(first)],
        [MSWB_COMMAND_TRAIT.last]: [ref(last)],
      },
      undefined,
      null,
    ),
  replace: (parent: string, trait: string, first: string, nodes: RawNode[]) =>
    node(
      MSWB_COMMAND.replace,
      {
        [MSWB_COMMAND_TRAIT.parent]: [ref(parent)],
        [MSWB_COMMAND_TRAIT.trait]: [traitName(trait)],
        [MSWB_COMMAND_TRAIT.first]: [ref(first)],
        [MSWB_COMMAND_TRAIT.last]: [ref(first)],
        [MSWB_COMMAND_TRAIT.content]: nodes,
      },
      undefined,
      null,
    ),
  move: (parent: string, trait: string, moved: string, after?: string) =>
    node(
      MSWB_COMMAND.move,
      {
        [MSWB_COMMAND_TRAIT.parent]: [ref(parent)],
        [MSWB_COMMAND_TRAIT.trait]: [traitName(trait)],
        ...(after ? { [MSWB_COMMAND_TRAIT.afterSibling]: [ref(after)] } : {}),
        [MSWB_COMMAND_TRAIT.sourceParent]: [ref(parent)],
        [MSWB_COMMAND_TRAIT.sourceTrait]: [traitName(trait)],
        [MSWB_COMMAND_TRAIT.sourceFirst]: [ref(moved)],
        [MSWB_COMMAND_TRAIT.sourceLast]: [ref(moved)],
      },
      undefined,
      null,
    ),
  tag: (target: string) =>
    node(
      MSWB_COMMAND.tag,
      { '31456a3e-c67b-5b71-bd00-0d6b64609184': [ref(target)] },
      undefined,
      null,
    ),
};

/** A change history writer: each change gets the next sync order and a later timestamp. */
export function history(start = Date.UTC(2026, 0, 1)) {
  let order = 0;
  let clock = start;
  const changes: RawChange[] = [];
  const add = (type: string, gch: Record<string, unknown>, extra: Partial<RawChange> = {}) => {
    const fuid = `changes-${++order}`;
    const change: RawChange = {
      type,
      fuid,
      changeOrder: order,
      compression: 0,
      gch: { dtu: new Date((clock += 1000)).toISOString(), fuid, ...gch },
      ...extra,
    };
    changes.push(change);
    return change;
  };
  return {
    changes,
    insert: (
      parent: string,
      trait: string,
      nodes: RawNode[],
      place: { after?: string; before?: string } = {},
    ) =>
      add('FchInsert', {
        insertTrees: nodes,
        fuidnParentDst: parent,
        traitDst: trait,
        ...(place.after ? { fuidncBeforeDst: place.after } : {}),
        ...(place.before ? { fuidncAfterDst: place.before } : {}),
      }),
    remove: (parent: string, trait: string, first: string, last = first) =>
      add('FchDelete', {
        fuidnParentDst: parent,
        traitDst: trait,
        fuidncFirstDst: first,
        fuidncLastDst: last,
      }),
    replace: (parent: string, trait: string, first: string, nodes: RawNode[]) =>
      add('FchReplace', {
        insertTrees: nodes,
        fuidnParentDst: parent,
        traitDst: trait,
        fuidncFirstDst: first,
        fuidncLastDst: first,
      }),
    move: (
      parent: string,
      trait: string,
      moved: string,
      place: { after?: string; before?: string },
    ) =>
      add('FchMove', {
        fuidnParentSrc: parent,
        traitSrc: trait,
        fuidncFirstSrc: moved,
        fuidncLastSrc: moved,
        fuidnParentDst: parent,
        traitDst: trait,
        ...(place.after ? { fuidncBeforeDst: place.after } : {}),
        ...(place.before ? { fuidncAfterDst: place.before } : {}),
      }),
    group: (commands: RawNode[]) => add('FchGroup', { groupTrees: commands }),
    undo: (...targets: RawChange[]) => add('FchUndo', { fuids: targets.map((t) => t.fuid) }),
    redo: (...targets: RawChange[]) => add('FchRedo', { fuids: targets.map((t) => t.fuid) }),
    /** An image insert that finished uploading late: a later sync order, an earlier timestamp. */
    lateImageInsert: (
      parent: string,
      image: RawNode,
      dataId: string,
      objectId: string,
      at: Date,
    ) => {
      const change = add(
        'FchInsert',
        { insertTrees: [image], fuidnParentDst: parent, traitDst: MSWB_TRAIT.children },
        {
          deferred: [{ id: objectId, fuid: dataId, type: 'Image' }],
        },
      );
      change.gch.dtu = at.toISOString();
      return change;
    },
  };
}

// ---- a whole board --------------------------------------------------------------------------

export const ROOT_ID = 'tree-root-1';
export const LAYER_ID = 'tree-root-2';
export const CANVAS_ID = 'tree-root-3';

export function treeInit(): RawNode {
  return node(
    MSWB_TYPE.root,
    {
      [MSWB_TRAIT.children]: [
        node(
          MSWB_TYPE.layer,
          { [MSWB_TRAIT.children]: [node(MSWB_TYPE.canvas, {}, undefined, CANVAS_ID)] },
          undefined,
          LAYER_ID,
        ),
      ],
    },
    undefined,
    ROOT_ID,
  );
}

export type BoardDescription = {
  id?: string;
  title?: string | null;
  modified?: string;
  background?: string;
  pattern?: string;
  elements?: RawNode[];
  /** Changes written after the elements (edits, undos), given the history writer. */
  edit?: (h: ReturnType<typeof history>) => void;
  images?: { objectId: string; dataId: string; file: string; bytes: Uint8Array; image: RawNode }[];
};

/** A board export's files, keyed by path under `dir`. */
export function boardFiles(d: BoardDescription, dir = 'board'): Map<string, Uint8Array> {
  const h = history();
  if (d.background)
    h.group([command.insert(CANVAS_ID, MSWB_TRAIT.background, [argb(d.background)])]);
  if (d.pattern) h.group([command.insert(CANVAS_ID, MSWB_TRAIT.pattern, [enumValue(d.pattern)])]);
  let last: string | undefined;
  for (const el of d.elements ?? []) {
    h.insert(CANVAS_ID, MSWB_TRAIT.children, [el], last ? { after: last } : {});
    last = el.fuid;
  }
  for (const img of d.images ?? []) {
    const change = h.insert(
      CANVAS_ID,
      MSWB_TRAIT.children,
      [img.image],
      last ? { after: last } : {},
    );
    change.deferred = [{ id: img.objectId, fuid: img.dataId, type: 'Image' }];
    last = img.image.fuid;
  }
  d.edit?.(h);
  const id = d.id ?? 'board-id';
  const json = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
  const p = (name: string) => (dir ? `${dir}/${name}` : name);
  const files = new Map<string, Uint8Array>([
    [p('session.json'), json({ id, treeInit: treeInit() })],
    [p('changes.json'), json(h.changes)],
    [
      p('manifest.json'),
      json({
        id,
        title: d.title ?? null,
        changes: h.changes.length,
        objects: (d.images ?? []).map((i) => ({
          id: i.objectId,
          file: i.file,
          contentType: 'image/*',
          bytes: i.bytes.length,
        })),
        missingObjects: [],
        errors: [],
      }),
    ],
    [
      p('metadata.json'),
      json({
        id,
        title: d.title ?? null,
        createdTime: '2026-01-01T00:00:00Z',
        lastModifiedTime: d.modified ?? '2026-01-02T00:00:00Z',
      }),
    ],
  ]);
  for (const img of d.images ?? []) files.set(p(`objects/${img.file}`), img.bytes);
  return files;
}

/** A 1×1 PNG's bytes (signature and IHDR are what the import sniffs). */
export const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 6, 0, 0, 0,
]);

/** Files as the import reads them: each read on demand. */
export function fileSet(
  ...maps: Map<string, Uint8Array>[]
): Map<string, () => Promise<Uint8Array>> {
  const set = new Map<string, () => Promise<Uint8Array>>();
  for (const m of maps) for (const [path, bytes] of m) set.set(path, () => Promise.resolve(bytes));
  return set;
}
