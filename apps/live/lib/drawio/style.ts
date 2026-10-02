// A draw.io cell's style string (docs/specs/020-import-export/blueprints/drawio-import.md
// step 5): `name;key=value;...`. Bare tokens are named styles from draw.io's
// stylesheet; the few that matter carry defaults, merged UNDER the cell's own
// pairs so an explicit value always wins.

type Pairs = Record<string, string>;

// From draw.io's default stylesheet (styles/default.xml), only the keys the
// importer reads.
const TEXT: Pairs = { fillColor: 'none', strokeColor: 'none', align: 'left', verticalAlign: 'top' };
const LABEL: Pairs = { fontStyle: '1', align: 'left', rounded: '1' };
const NAMED_STYLES: Record<string, Pairs> = {
  text: TEXT,
  edgeLabel: { ...TEXT, fontSize: '11' },
  label: LABEL,
  icon: {
    ...LABEL,
    align: 'center',
    verticalLabelPosition: 'bottom',
    verticalAlign: 'top',
    fontStyle: '0',
  },
  swimlane: { shape: 'swimlane', fontStyle: '1', startSize: '23' },
  group: { verticalAlign: 'top', fillColor: 'none', strokeColor: 'none' },
  ellipse: { shape: 'ellipse', perimeter: 'ellipsePerimeter' },
  rhombus: { shape: 'rhombus', perimeter: 'rhombusPerimeter' },
  triangle: { shape: 'triangle', perimeter: 'trianglePerimeter' },
  line: { shape: 'line', strokeWidth: '4' },
  image: { shape: 'image', verticalLabelPosition: 'bottom', verticalAlign: 'top' },
  arrow: { shape: 'arrow' },
};

const VERTEX_DEFAULTS: Pairs = { fontSize: '12', perimeter: 'rectanglePerimeter' };
const EDGE_DEFAULTS: Pairs = { endArrow: 'classic', fontSize: '11' };

// Named styles that are not shapes: they style a label or a group and leave
// the cell a rectangle.
const NON_SHAPE_NAMES = new Set(['text', 'edgeLabel', 'label', 'icon', 'group', 'html']);

export type DrawioStyle = {
  /** Bare tokens, in order. */
  readonly names: readonly string[];
  str(key: string): string | undefined;
  /** A finite number, else undefined. */
  num(key: string): number | undefined;
  /** `1` or `true`. */
  flag(key: string): boolean;
  has(name: string): boolean;
};

export function parseStyle(raw: string, isEdge: boolean): DrawioStyle {
  const names: string[] = [];
  const own: Pairs = {};
  for (const token of raw.split(';')) {
    if (token === '') continue;
    const eq = token.indexOf('=');
    if (eq < 0) {
      names.push(token);
    } else if (eq > 0) {
      own[token.slice(0, eq)] = token.slice(eq + 1);
    }
  }
  const merged: Pairs = { ...(isEdge ? EDGE_DEFAULTS : VERTEX_DEFAULTS) };
  for (const name of names) Object.assign(merged, NAMED_STYLES[name]);
  Object.assign(merged, own);

  const str = (key: string) => merged[key];
  return {
    names,
    str,
    num(key) {
      const v = str(key);
      if (v === undefined || v.trim() === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    },
    flag(key) {
      const v = str(key);
      return v === '1' || v === 'true';
    },
    has: (name) => names.includes(name),
  };
}

/** The shape a style draws: `shape=`, else the first named style that is a
 *  shape, else `''` (draw.io's plain rectangle). */
export function shapeName(style: DrawioStyle): string {
  const explicit = style.str('shape');
  if (explicit) return explicit;
  return style.names.find((n) => !NON_SHAPE_NAMES.has(n)) ?? '';
}
