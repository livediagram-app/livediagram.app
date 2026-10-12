// A Sankey diagram as it is drawn (docs/specs/009-elements/sankey.md "How it draws"): the layout, every
// node's colour, every band's paint, every label's place and words, and the readout text for a hover. One
// function both renderers call, so the canvas view and the exporter differ only in the markup they emit.

import { chartPaletteColors } from './chart-palettes';
import { isLightColor } from './colors';
import { PIE_PALETTE } from './data-shapes';
import type { ShapeElement, TextSize } from './index';
import { sankeyLayout, type SankeyLayout, type SankeyLinkBand, type SankeyNodeBox } from './sankey-layout';
import {
  formatSankeyPercent,
  formatSankeyValue,
  sankeyNodeColor,
  type SankeyLinkColor,
} from './sankey-model';

/** The node labels' size per Text Size: smaller than a shape label, since a diagram holds many. */
export const SANKEY_LABEL_PX: Record<TextSize, number> = { sm: 10, md: 12, lg: 15, scale: 12 };
export const SANKEY_EDGE_PAD_PX = 8; // kept clear inside the box on every side
export const SANKEY_BAND_OPACITY = 0.42; // bands at rest: present, but the nodes still lead
export const SANKEY_BAND_FOCUS_OPACITY = 0.78; // the hovered band, or every band of a hovered node
export const SANKEY_BAND_DIM_OPACITY = 0.1; // everything else while something is hovered
export const SANKEY_NEUTRAL_BAND = '#94a3b8'; // slate-400: reads on white and on a dark theme alike
export const SANKEY_LABEL_GAP_PX = 6; // between a node's bar and its label

/**
 * The halo drawn behind a label so it reads over the bands: the opposite of the label's own colour, so dark
 * theme text gets a white halo and light text a deep one.
 */
export function sankeyLabelHalo(textColor: string): string {
  return isLightColor(textColor) ? '#0f172a' : '#ffffff';
}

export function sankeyLabelPx(textSize: TextSize | undefined): number {
  return SANKEY_LABEL_PX[textSize ?? 'md'];
}

export type SankeyBandPaint =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string };

export type SankeyLabel = {
  node: number;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  name: string;
  /** The amount or share line; '' when the diagram shows names only. */
  detail: string;
  /** Detail on the name's own line (a short node has no room for a second line). */
  inline: boolean;
};

export type SankeyFrame = {
  w: number;
  h: number;
  layout: SankeyLayout;
  fontPx: number;
  nodeColor: (node: number) => string;
  bandPaint: (band: SankeyLinkBand) => SankeyBandPaint;
  labels: SankeyLabel[];
  /** One sentence for a screen reader: what the diagram shows, and its biggest flow. */
  summary: string;
};

export function sankeyFrame(element: ShapeElement, palette?: readonly string[]): SankeyFrame {
  const w = Math.max(1, element.width);
  const h = Math.max(1, element.height);
  const fontPx = sankeyLabelPx(element.textSize);
  // Room above the top node and below the bottom one for a centred two-line label.
  const padY = Math.max(SANKEY_EDGE_PAD_PX, Math.round(fontPx * 0.6));
  const layout = sankeyLayout(
    element.sankeyFlows,
    {
      x: SANKEY_EDGE_PAD_PX,
      y: padY,
      w: Math.max(1, w - 2 * SANKEY_EDGE_PAD_PX),
      h: Math.max(1, h - 2 * padY),
    },
    element.sankeyAlign,
  );
  // The chart colour ladder (docs/specs/009-elements/pie-chart.md "Chart palettes"): a node's own colour,
  // then the diagram's palette, then the tab theme's ramp, then the built-in one; by first appearance.
  const ramp =
    chartPaletteColors(element.chartPalette) ??
    (palette && palette.length > 0 ? palette : PIE_PALETTE);
  const colors = layout.nodes.map(
    (n) => sankeyNodeColor(element.sankeyNodes, n.name) ?? ramp[n.index % ramp.length]!,
  );
  const nodeColor = (i: number) => colors[i] ?? ramp[0]!;
  const mode: SankeyLinkColor = element.sankeyLinkColor ?? 'gradient';
  const bandPaint = (b: SankeyLinkBand): SankeyBandPaint => {
    if (mode === 'neutral') return { kind: 'solid', color: SANKEY_NEUTRAL_BAND };
    if (mode === 'source') return { kind: 'solid', color: nodeColor(b.source) };
    if (mode === 'target') return { kind: 'solid', color: nodeColor(b.target) };
    const from = nodeColor(b.source);
    const to = nodeColor(b.target);
    return from === to ? { kind: 'solid', color: from } : { kind: 'gradient', from, to };
  };

  const show = element.sankeyValueLabel ?? 'value';
  const labels: SankeyLabel[] = layout.nodes.map((n) => {
    // Inward-facing: a node left of the middle labels to its right, the rest to their left, so a label sits
    // over the bands rather than off the edge of the box.
    const right = layout.columns <= 1 || (n.x0 + n.x1) / 2 < w / 2;
    const detail =
      show === 'none'
        ? ''
        : show === 'percent'
          ? formatSankeyPercent(n.value, layout.total)
          : formatSankeyValue(n.value, element.sankeyUnit);
    return {
      node: n.index,
      x: right ? n.x1 + SANKEY_LABEL_GAP_PX : n.x0 - SANKEY_LABEL_GAP_PX,
      y: (n.y0 + n.y1) / 2,
      anchor: right ? 'start' : 'end',
      name: n.name,
      detail,
      inline: detail !== '' && n.y1 - n.y0 < fontPx * 2.4,
    };
  });

  return { w, h, layout, fontPx, nodeColor, bandPaint, labels, summary: sankeySummary(layout, element.sankeyUnit) };
}

function sankeySummary(layout: SankeyLayout, unit?: string): string {
  const { nodes, links } = layout;
  if (links.length === 0) return 'Sankey diagram with no flows yet';
  const top = links.reduce((a, b) => (b.value > a.value ? b : a));
  return (
    `Sankey diagram: ${links.length} ${links.length === 1 ? 'flow' : 'flows'} between ` +
    `${nodes.length} nodes in ${layout.columns} ${layout.columns === 1 ? 'column' : 'columns'}. ` +
    `Largest: ${nodes[top.source]!.name} to ${nodes[top.target]!.name}, ${formatSankeyValue(top.value, unit)}.`
  );
}

/** A hovered band's readout: where it runs, how much, and its share of what leaves the source. */
export function sankeyBandReadout(
  layout: SankeyLayout,
  band: SankeyLinkBand,
  unit?: string,
): { title: string; detail: string } {
  const s = layout.nodes[band.source]!;
  const t = layout.nodes[band.target]!;
  return {
    title: `${s.name} → ${t.name}`,
    detail: `${formatSankeyValue(band.value, unit)} · ${formatSankeyPercent(band.value, s.outflow)} of ${s.name}`,
  };
}

/** A hovered node's readout: what arrives, what leaves, and anything unaccounted for between them. */
export function sankeyNodeReadout(
  node: SankeyNodeBox,
  unit?: string,
): { title: string; detail: string } {
  const parts: string[] = [];
  if (node.inflow > 0) parts.push(`In ${formatSankeyValue(node.inflow, unit)}`);
  if (node.outflow > 0) parts.push(`Out ${formatSankeyValue(node.outflow, unit)}`);
  // A middle node that sends on less than it receives (or more) is usually a typo; say so quietly.
  if (node.inflow > 0 && node.outflow > 0 && Math.abs(node.inflow - node.outflow) > 1e-9) {
    const diff = node.inflow - node.outflow;
    parts.push(
      diff > 0
        ? `${formatSankeyValue(diff, unit)} not sent on`
        : `${formatSankeyValue(-diff, unit)} more out than in`,
    );
  }
  return { title: node.name, detail: parts.join(' · ') };
}
