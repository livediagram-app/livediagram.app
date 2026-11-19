// The common Basic Shapes and Basic Flowchart Shapes masters, each to the draw.io style it is built as
// (docs/specs/020-import-export/visio-import.md "Shapes"). Pure data: the draw.io converter does the rest. A row
// marked approximated is counted here, so every style it names is one draw.io maps exactly.

type MasterRow = { style: string; approximated?: true };

const RECT = '';
const ROUNDED = 'rounded=1';
const ELLIPSE = 'ellipse';
const DIAMOND = 'rhombus';
const TRIANGLE_UP = 'triangle;direction=north';
const TRIANGLE_DOWN = 'triangle;direction=south';
const HEXAGON = 'hexagon';
const CYLINDER = 'shape=cylinder3';
const PARALLELOGRAM = 'shape=parallelogram';
const TRAPEZOID = 'shape=trapezoid';
const DOCUMENT = 'shape=document';
const TERMINATOR = 'shape=mxgraph.flowchart.terminator';
const STAR = 'shape=mxgraph.basic.star';
const TEXT = 'text';

const exact = (style: string): MasterRow => ({ style });
const near = (style: string): MasterRow => ({ style, approximated: true });

const MASTERS: Readonly<Record<string, MasterRow>> = {
  rectangle: exact(RECT),
  square: exact(RECT),
  process: exact(RECT),
  'rounded rectangle': exact(ROUNDED),
  'rounded square': exact(ROUNDED),
  ellipse: exact(ELLIPSE),
  circle: exact(ELLIPSE),
  'on-page reference': exact(ELLIPSE),
  diamond: exact(DIAMOND),
  decision: exact(DIAMOND),
  triangle: exact(TRIANGLE_UP),
  hexagon: exact(HEXAGON),
  preparation: exact(HEXAGON),
  can: exact(CYLINDER),
  cylinder: exact(CYLINDER),
  database: exact(CYLINDER),
  parallelogram: exact(PARALLELOGRAM),
  data: exact(PARALLELOGRAM),
  trapezoid: exact(TRAPEZOID),
  document: exact(DOCUMENT),
  'start/end': exact(TERMINATOR),
  terminator: exact(TERMINATOR),
  '5-point star': exact(STAR),
  star: exact(STAR),
  annotation: exact(TEXT),
  // Approximated: a master livediagram draws as its nearest shape.
  pentagon: near(HEXAGON),
  heptagon: near(HEXAGON),
  octagon: near(HEXAGON),
  decagon: near(HEXAGON),
  'right triangle': near(TRIANGLE_UP),
  merge: near(TRIANGLE_DOWN),
  extract: near(TRIANGLE_UP),
  subprocess: near(RECT),
  'predefined process': near(RECT),
  'off-page reference': near(RECT),
  'internal storage': near(RECT),
  card: near(RECT),
  cube: near(RECT),
  'custom 1': near(RECT),
  'custom 2': near(RECT),
  'custom 3': near(RECT),
  'custom 4': near(RECT),
  'multiple documents': near(DOCUMENT),
  'paper tape': near(DOCUMENT),
  'stored data': near(CYLINDER),
  'direct data': near(CYLINDER),
  'sequential data': near(CYLINDER),
  'external data': near(CYLINDER),
  'manual input': near(TRAPEZOID),
  'manual operation': near(TRAPEZOID),
  'loop limit': near(TRAPEZOID),
  delay: near(TERMINATOR),
  display: near(TERMINATOR),
  sort: near(DIAMOND),
  collate: near(DIAMOND),
};

const isDigits = (s: string) => s.length > 0 && [...s].every((ch) => ch >= '0' && ch <= '9');

/** A master name as the table keys it: trimmed, lower case, without Visio's `.12` copy number. */
export function normaliseMasterName(name: string): string {
  let out = name.trim().toLowerCase();
  const dot = out.lastIndexOf('.');
  if (dot > 0 && isDigits(out.slice(dot + 1))) out = out.slice(0, dot).trimEnd();
  return out;
}

/** The draw.io style a master is built as, or undefined for a master the table does not map. */
export function masterStyle(name: string): MasterRow | undefined {
  const key = normaliseMasterName(name);
  return Object.hasOwn(MASTERS, key) ? MASTERS[key] : undefined;
}

/** The shown name of a master in the report: its name without the copy number, as written. */
export function masterDisplayName(name: string): string {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf('.');
  return dot > 0 && isDigits(trimmed.slice(dot + 1)) ? trimmed.slice(0, dot).trimEnd() : trimmed;
}
