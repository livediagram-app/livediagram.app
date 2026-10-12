// The Flows table's levels (docs/specs/009-elements/sankey.md "The Flows dialog"): the draft rows grouped as
// the diagram reads, left to right. A level is one step of the diagram (a node's longest path from a start
// node) that some node sends from; in it, a group per such node, holding its flows. A node that only ends
// has no group and makes no level of its own: the rows into it carry it on. Rows with no From yet are loose,
// written in full until they join a group. Pure, so the table only renders it.

import {
  chartPaletteColors,
  cleanSankeyName,
  PIE_PALETTE,
  sankeyColumns,
  sankeyGraph,
  sankeyNodeColor,
  type ChartPaletteId,
  type SankeyGraph,
  type SankeyNodeStyle,
} from '@livediagram/document';
import { draftFlows, type SankeyDraftRow } from '@/lib/sankey-flow-rows';

/** A draft row and its index in the draft (its flow's position, which the reasons and labels use). */
export type FlowLevelRow = { row: SankeyDraftRow; index: number };

/** A node that sends something, and the rows that carry it. */
export type FlowSource = { name: string; rows: FlowLevelRow[] };

/** One step of the diagram: the nodes sending from it. */
export type FlowLevel = { step: number; sources: FlowSource[] };

export type FlowLevels = { levels: FlowLevel[]; loose: FlowLevelRow[] };

/**
 * Groups `rows` into levels. A source's step is its column with every node at its own step (By Step), so the
 * levels follow the diagram's columns; a source the diagram does not draw yet (its only flows are set aside)
 * counts as a start. Sources and ends keep first-written order within a level. Rows keyed in `keepLoose` stay
 * loose whatever their From (a row still being written in the Add a Flow area, which must not move mid-edit).
 */
export function flowLevels(
  rows: readonly SankeyDraftRow[],
  keepLoose: ReadonlySet<number> = new Set(),
): FlowLevels {
  const graph = sankeyGraph(draftFlows(rows));
  const steps = sankeyColumns(graph, 'left');
  const stepOf = new Map(graph.nodes.map((n, i) => [n.name, steps[i]!]));
  const sources = new Map<string, FlowSource>();
  const loose: FlowLevelRow[] = [];
  rows.forEach((row, index) => {
    const name = cleanSankeyName(row.from);
    if (!name || keepLoose.has(row.key)) return void loose.push({ row, index });
    const group = sources.get(name);
    if (group) group.rows.push({ row, index });
    else sources.set(name, { name, rows: [{ row, index }] });
  });

  const levels = new Map<number, FlowLevel>();
  const levelAt = (step: number): FlowLevel => {
    let level = levels.get(step);
    if (!level) levels.set(step, (level = { step, sources: [] }));
    return level;
  };
  for (const source of sources.values()) levelAt(stepOf.get(source.name) ?? 0).sources.push(source);
  return { levels: [...levels.values()].sort((a, b) => a.step - b.step), loose };
}

/** What enters and what leaves each node the diagram draws, by name. */
export function flowTotals(graph: SankeyGraph): Map<string, { inflow: number; outflow: number }> {
  return new Map(graph.nodes.map((n) => [n.name, { inflow: n.inflow, outflow: n.outflow }]));
}

/**
 * Each drawn node's colour, as the diagram paints it: its own colour, then the diagram's palette, then the
 * tab theme's, then the built-in one, by first appearance.
 */
export function flowNodeColors(
  graph: SankeyGraph,
  nodes: readonly SankeyNodeStyle[] | undefined,
  palette: readonly string[] | undefined,
  chartPalette: ChartPaletteId | undefined,
): Map<string, string> {
  const ramp =
    chartPaletteColors(chartPalette) ?? (palette && palette.length > 0 ? palette : PIE_PALETTE);
  return new Map(
    graph.nodes.map((n) => [
      n.name,
      sankeyNodeColor(nodes, n.name) ?? ramp[n.index % ramp.length]!,
    ]),
  );
}
