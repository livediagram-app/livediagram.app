// Who reads what (blueprint sheets-engine.md "Dependency graph"): recorded while a formula is worked out, so
// INDIRECT and OFFSET are tracked as they are read. Single cells by id; ranges by position in a per-column index,
// so the readers of one changed cell are found without scanning every formula.
export type ReaderId = string;

type RangeEntry = { r1: number; r2: number; reader: ReaderId };
type Registration =
  | { kind: 'cell'; cell: string }
  | { kind: 'range'; sheetId: string; cols: number[]; entry: RangeEntry };

export class Dependencies {
  private readonly cellReaders = new Map<string, Set<ReaderId>>();
  // sheetId -> column position -> entries.
  private readonly rangeReaders = new Map<string, Map<number, Set<RangeEntry>>>();
  private readonly regs = new Map<ReaderId, Registration[]>();

  private regsOf(reader: ReaderId): Registration[] {
    let r = this.regs.get(reader);
    if (!r) {
      r = [];
      this.regs.set(reader, r);
    }
    return r;
  }

  noteCell(reader: ReaderId, cell: string): void {
    let set = this.cellReaders.get(cell);
    if (!set) {
      set = new Set();
      this.cellReaders.set(cell, set);
    }
    if (set.has(reader)) return;
    set.add(reader);
    this.regsOf(reader).push({ kind: 'cell', cell });
  }

  noteRange(
    reader: ReaderId,
    sheetId: string,
    r1: number,
    c1: number,
    r2: number,
    c2: number,
  ): void {
    let byCol = this.rangeReaders.get(sheetId);
    if (!byCol) {
      byCol = new Map();
      this.rangeReaders.set(sheetId, byCol);
    }
    const entry: RangeEntry = { r1, r2, reader };
    const cols: number[] = [];
    for (let c = c1; c <= c2; c++) {
      let set = byCol.get(c);
      if (!set) {
        set = new Set();
        byCol.set(c, set);
      }
      set.add(entry);
      cols.push(c);
    }
    this.regsOf(reader).push({ kind: 'range', sheetId, cols, entry });
  }

  // Forget what a reader read (before it is worked out again).
  clear(reader: ReaderId): void {
    const regs = this.regs.get(reader);
    if (!regs) return;
    for (const reg of regs) {
      if (reg.kind === 'cell') this.cellReaders.get(reg.cell)?.delete(reader);
      else {
        const byCol = this.rangeReaders.get(reg.sheetId);
        for (const c of reg.cols) byCol?.get(c)?.delete(reg.entry);
      }
    }
    this.regs.delete(reader);
  }

  // The readers of a cell, by its id and its position.
  readersOf(cell: string, sheetId: string, r: number, c: number, out: Set<ReaderId>): void {
    const singles = this.cellReaders.get(cell);
    if (singles) for (const x of singles) out.add(x);
    const entries = this.rangeReaders.get(sheetId)?.get(c);
    if (entries) for (const e of entries) if (r >= e.r1 && r <= e.r2) out.add(e.reader);
  }

  reset(): void {
    this.cellReaders.clear();
    this.rangeReaders.clear();
    this.regs.clear();
  }
}
