// A Visio shape's sheet (docs/specs/020-import-export/visio-import.md "Units and geometry", "Inheritance"): its
// cells and section rows, each read from the shape itself, else from its master's shape. A value is the cell's
// `V`, the last computed result of its formula. Style sheets are never read: what neither sets is the theme's.

type Indexed = {
  cells: Map<string, string>;
  sections: Map<string, Element[]>;
  text: Element | null;
};

const indexes = new WeakMap<Element, Indexed>();

function indexOf(shape: Element): Indexed {
  const cached = indexes.get(shape);
  if (cached) return cached;
  const out: Indexed = { cells: new Map(), sections: new Map(), text: null };
  for (const child of Array.from(shape.children)) {
    if (child.localName === 'Cell') {
      const name = child.getAttribute('N');
      const value = child.getAttribute('V');
      if (name && value !== null) out.cells.set(name, value);
    } else if (child.localName === 'Section') {
      const name = child.getAttribute('N') ?? '';
      const list = out.sections.get(name) ?? [];
      list.push(child);
      out.sections.set(name, list);
    } else if (child.localName === 'Text') {
      out.text = child;
    }
  }
  indexes.set(shape, out);
  return out;
}

/** A row's cell in a section: `<Row IX="..."><Cell N="..." V="..."/></Row>`. */
function rowCell(section: Element, rowIx: string, name: string): string | undefined {
  for (const row of Array.from(section.children)) {
    if (row.localName !== 'Row' || (row.getAttribute('IX') ?? '0') !== rowIx) continue;
    for (const cell of Array.from(row.children)) {
      if (cell.localName === 'Cell' && cell.getAttribute('N') === name) {
        return cell.getAttribute('V') ?? undefined;
      }
    }
  }
  return undefined;
}

export const finite = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export class ShapeSheet {
  readonly own: Element;
  readonly master: Element | null;

  constructor(own: Element, master: Element | null) {
    this.own = own;
    this.master = master;
  }

  cell(name: string): string | undefined {
    return (
      indexOf(this.own).cells.get(name) ??
      (this.master ? indexOf(this.master).cells.get(name) : undefined)
    );
  }

  num(name: string): number | undefined {
    return finite(this.cell(name));
  }

  /** The shape's sections of a kind, else its master's. */
  sections(name: string): Element[] {
    const own = indexOf(this.own).sections.get(name);
    if (own && own.length > 0) return own;
    return (this.master && indexOf(this.master).sections.get(name)) || [];
  }

  /** A cell of a section's row (the first character run, the first paragraph), the shape's, else its master's. */
  row(section: string, rowIx: string, name: string): string | undefined {
    for (const sheet of this.master ? [this.own, this.master] : [this.own]) {
      for (const s of indexOf(sheet).sections.get(section) ?? []) {
        const value = rowCell(s, rowIx, name);
        if (value !== undefined) return value;
      }
    }
    return undefined;
  }

  /** The `<Text>` element: the shape's own, else its master's. */
  text(): Element | null {
    return indexOf(this.own).text ?? (this.master ? indexOf(this.master).text : null);
  }
}

/** A section's own cell (a geometry section's `NoFill`, `NoLine`, `NoShow`). */
export function sectionCell(section: Element, name: string): string | undefined {
  for (const cell of Array.from(section.children)) {
    if (cell.localName === 'Cell' && cell.getAttribute('N') === name)
      return cell.getAttribute('V') ?? undefined;
  }
  return undefined;
}

/** A section's rows in order, each with its type (`T`) and its cells by name. */
export function sectionRows(section: Element): { type: string; cells: Map<string, string> }[] {
  const out: { type: string; cells: Map<string, string> }[] = [];
  for (const row of Array.from(section.children)) {
    if (row.localName !== 'Row') continue;
    const cells = new Map<string, string>();
    for (const cell of Array.from(row.children)) {
      const name = cell.getAttribute('N');
      const value = cell.getAttribute('V');
      if (cell.localName === 'Cell' && name && value !== null) cells.set(name, value);
    }
    out.push({ type: row.getAttribute('T') ?? '', cells });
  }
  return out;
}

// Visio's standard colour table, the indexes a cell can name without a document table.
const STANDARD_COLOURS = [
  '#000000',
  '#ffffff',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#ff00ff',
  '#00ffff',
  '#800000',
  '#008000',
  '#000080',
  '#808000',
  '#800080',
  '#008080',
  '#c0c0c0',
  '#e6e6e6',
  '#cdcdcd',
  '#b3b3b3',
  '#9a9a9a',
  '#808080',
  '#666666',
  '#4d4d4d',
  '#333333',
  '#1a1a1a',
];

const HEX_DIGITS = '0123456789abcdef';
const isHex6 = (value: string) =>
  value.length === 7 &&
  value.startsWith('#') &&
  [...value.slice(1).toLowerCase()].every((ch) => HEX_DIGITS.includes(ch));

/**
 * A colour cell's value as `#rrggbb`: a hex value kept, an index read from the document's colour table, else
 * Visio's standard one; anything else (a theme reference without a computed value) is undefined.
 */
export function visioColour(
  value: string | undefined,
  table: ReadonlyMap<number, string>,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (isHex6(trimmed)) return trimmed.toLowerCase();
  const index = finite(trimmed);
  if (index === undefined || !Number.isInteger(index) || index < 0) return undefined;
  const hex = table.get(index) ?? STANDARD_COLOURS[index];
  return hex && isHex6(hex) ? hex.toLowerCase() : undefined;
}
