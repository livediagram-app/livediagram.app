// What a text colour picker judges its colours against (each product's docs/specs/004-interface-design/
// colour-picker.md "Reading on its ground"): the ground under the label, whether it is large text, the colour it is
// drawn in now, and how each swatch would be drawn there. Pure. One copy for every product; each binds
// `textContrastProbesFor` to its own grounds and default inks at its lib/text-contrast-probe.ts.
import { canvasSurface, type CanvasSurface } from './colour-math';
import { isBoxed, type BoxedElement, type Element, type TableElement } from './element';
import { isPenColourName, penColourHex } from './pen-colours';
import { isHexColour } from './standard-colours';
import { tableHeaderColours } from './table-header-colours';
import {
  cellTextGround,
  cellTextSize,
  isHeaderCell,
  isLargeText,
  labelDrawnPx,
  labelIsBold,
  type TextGround,
} from './text-contrast';
import { textGroundMemo, type GroundOf, type ProbeTab } from './text-ground-memo';

export type TextContrastProbe = {
  ground: TextGround;
  large: boolean;
  // Judged as it is saved or exported, not as drawn for this person: a page on a dark canvas (its plain paper is
  // drawn dark but exports white), or a canvas seen in the other appearance.
  exported: boolean;
  // The label's colour as drawn on its ground; null when it can't be read.
  current: string | null;
  // A swatch's colour as it would be drawn there: a stock name in its version for the ground.
  colourOf: (id: string) => string | null;
  // How many texts this one ground stands for (table cells alike in ground, colour and size); 1 when absent.
  count?: number;
};

/** A product's grounds and inks. */
export type TextProbeModel<T extends ProbeTab, B extends BoxedElement = BoxedElement> = {
  groundOf: GroundOf<T, B>;
  defaultTextColor: (el: B, surface: CanvasSurface) => string;
  // Whether a ground is judged as saved or exported rather than as this person sees it.
  exported: (ground: TextGround, surface: CanvasSurface, tab: T) => boolean;
};

// A swatch's colour drawn on a ground: a stock colour in its version for the ground's paper, a hex as it is.
function colourOn(ground: TextGround) {
  const board = canvasSurface(ground.tones[0]);
  return (id: string): string | null => {
    if (isPenColourName(id)) return penColourHex(id, board);
    return isHexColour(id) ? id.toLowerCase() : null;
  };
}

// The products' elements are the shared ones' shape, so one handed in is handed back to the model as its own.
export function textContrastProbesFor<T extends ProbeTab, B extends BoxedElement = BoxedElement>(
  model: TextProbeModel<T, B>,
) {
  const own = (el: BoxedElement) => el as B;
  /** The Text row's probe for `el`, or null where nothing can be judged (a picture, off every page). */
  function textContrastProbe(
    el: Element,
    tab: T,
    surface: CanvasSurface,
    groundOf: GroundOf<T, B> = model.groundOf,
  ): TextContrastProbe | null {
    if (!isBoxed(el)) return null;
    const ground = groundOf(own(el), tab, surface);
    if (!ground) return null;
    const colourOf = colourOn(ground);
    const set = el as { textColor?: string; penTextColour?: string };
    const current =
      set.textColor !== undefined
        ? colourOf(set.textColor)
        : set.penTextColour !== undefined
          ? colourOf(set.penTextColour)
          : colourOf(model.defaultTextColor(own(el), canvasSurface(ground.tones[0])));
    return {
      ground,
      large: isLargeText(labelDrawnPx(el), labelIsBold(el)),
      exported: model.exported(ground, surface, tab),
      current,
      colourOf,
    };
  }

  /**
   * The probes for every element of `els` whose ground can be judged (several grounds: the worst counts), each ground
   * memoised in `memo`; undefined when none can be judged. A table's text colour is its body cells' that have none of
   * their own (a header's ink is kept readable on its band), each judged on its cell.
   */
  function textContrastProbes(
    els: readonly Element[],
    tab: T,
    surface: CanvasSurface,
    memo: ReturnType<typeof textGroundMemo<T, B>> = textGroundMemo(model.groundOf),
  ): TextContrastProbe[] | undefined {
    const groundOf = memo.batch();
    const probes: TextContrastProbe[] = [];
    for (const el of els) {
      if (el.type === 'table') {
        probes.push(...(cellContrastProbes(el, tableTextCells(el), tab, surface, groundOf) ?? []));
        continue;
      }
      const probe = textContrastProbe(el, tab, surface, groundOf);
      if (probe) probes.push(probe);
    }
    return probes.length > 0 ? probes : undefined;
  }

  /**
   * The probes for a table's selected cells: each on its own background, the header band or the table's fill, else
   * what is under the table. Cells alike in ground, colour and size share one probe (its `count`), so a whole table
   * selected judges a handful, not every cell. Undefined when none can be judged.
   */
  function cellContrastProbes(
    table: TableElement,
    cells: readonly { r: number; c: number }[],
    tab: T,
    surface: CanvasSurface,
    groundOf: GroundOf<T, B> = model.groundOf,
  ): TextContrastProbe[] | undefined {
    // What is under the table (a table is never its own ground: its fill is its cells', read per cell below).
    const under = groundOf(own(table), tab, surface);
    const seen = new Map<string, TextContrastProbe>();
    for (const { r, c } of cells) {
      const ground = cellTextGround(table, r, c, surface, under);
      if (!ground) continue;
      const colourOf = colourOn(ground);
      const board = canvasSurface(ground.tones[0]);
      const cellInk = table.cellStyles?.[r]?.[c]?.textColor;
      const ink =
        cellInk ??
        (isHeaderCell(table, r, c)
          ? tableHeaderColours(table, surface).ink
          : (table.textColor ?? model.defaultTextColor(own(table), board)));
      const { px, bold } = cellTextSize(table, r, c);
      const large = isLargeText(px, bold);
      const current = colourOf(ink);
      const key = `${ground.on}|${ground.tones.join(',')}|${current}|${large}`;
      const kept = seen.get(key);
      if (kept) kept.count = (kept.count as number) + 1;
      else
        seen.set(key, {
          ground,
          large,
          exported: model.exported(ground, surface, tab),
          current,
          colourOf,
          count: 1,
        });
    }
    return seen.size > 0 ? [...seen.values()] : undefined;
  }

  return { textContrastProbe, textContrastProbes, cellContrastProbes };
}

/** The cells a table's own text colour reaches: its body cells with no colour of their own. */
export function tableTextCells(table: TableElement): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  (table.cells ?? []).forEach((row, r) =>
    row.forEach((_, c) => {
      if (!isHeaderCell(table, r, c) && table.cellStyles?.[r]?.[c]?.textColor === undefined)
        out.push({ r, c });
    }),
  );
  return out;
}
