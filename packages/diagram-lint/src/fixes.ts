// The fix every finding ends with (blueprint "Presentation and UX", LN29). A tab fix is edit operations
// in the line form: `; ` runs them in order, `, or ` offers alternatives, and `<ref>` and `<text>` are
// placeholders. A graph fix is a change to the source, in words or as a command.

import type { LintSource } from './context';

const pick = (source: LintSource, tab: string, graph: string) => (source === 'tab' ? tab : graph);

export const fixes = {
  boxOverlap: (s: LintSource, a: string, b: string) =>
    pick(s, `move ${b} right-of:${a}`, 'graph lint --compare direction,groups'),
  arrowDangling: (s: LintSource, arrow: string) => pick(s, `rm ${arrow}`, 'remove the edge'),
  // A style whose route clears every box, else advice: a style suggested blind passed behind another box, and the
  // next lint suggested the style back.
  arrowBehindBox: (
    s: LintSource,
    arrow: string,
    style: string | null,
    move: { box: string; by: { dx: number; dy: number } },
  ) =>
    pick(
      s,
      style ? `set ${arrow} line=${style}` : `move ${move.box} by=${move.by.dx},${move.by.dy}`,
      'drop the groups, or lines: angled',
    ),
  // `layout` lays out shapes alone, so on a tab with frames or lanes it would leave them behind: there the fix
  // reroutes the most-crossed arrow instead.
  // On a framed tab, a line style for one of the most-crossed arrows that strictly lowers its crossings, else advice:
  // a style suggested blind added crossings, and the next lint then suggested the style back.
  edgeCrossings: (s: LintSource, framed: { arrow: string; style: string | null } | null) =>
    pick(
      s,
      framed
        ? framed.style
          ? `set ${framed.arrow} line=${framed.style}`
          : `move a box so ${framed.arrow} crosses fewer lines`
        : 'layout type:shape',
      'graph lint --compare direction,groups,lines',
    ),
  labelCollision: (s: LintSource, arrow: string, fits: number) =>
    pick(
      s,
      `set ${arrow} label="<at most ${fits} characters>"`,
      `shorten the edge label to ${fits} characters`,
    ),
  labelOverflow: (s: LintSource, a: string, smaller: boolean) =>
    pick(
      s,
      smaller ? `set ${a} text=sm` : `set ${a} label="<text>" note="<text>"`,
      'shorten the label; detail goes in note',
    ),
  // A page's text: grown to hold its lines; two texts over each other moved apart.
  textOverflow: (a: string, height: number) => `set ${a} height=${height}`,
  textOverflowWidth: (a: string, width: number) => `set ${a} width=${width}`,
  textOverlap: (a: string, b: string) => `move ${b} below:${a}`,
  nodeIsolated: (s: LintSource, a: string) =>
    pick(s, `connect <ref> -> ${a}`, `add an edge to ${a}, or drop it`),
  groupEscape: (s: LintSource, a: string, frame: string) =>
    pick(s, `move ${a} inside:${frame}`, 'drop the group'),
  groupSplitEdges: (s: LintSource, frame: string) =>
    pick(s, `unwrap ${frame}`, 'group by ownership, or drop the groups'),
  duplicateLabel: (s: LintSource, b: string) =>
    pick(s, `set ${b} label="<text>"`, 'rename one, or merge the nodes'),
  // Both ends in one rewire: one end at a time would pass through a self-loop, which rewire refuses.
  flowBackwards: (s: LintSource, arrow: string, x: string, y: string) =>
    pick(s, `rewire ${arrow} from=${y} to=${x}`, 'reverse the edge, unless it is a loop'),
  aspectExtreme: (s: LintSource, direction: 'down' | 'right') =>
    pick(s, `layout type:shape direction=${direction}`, `direction: ${direction}`),
  colourOnThemed: (s: LintSource, a: string, fields: readonly ('fill' | 'stroke')[]) =>
    pick(s, `set ${a} ${fields.map((f) => `${f}=`).join(' ')}`, 'drop the colour'),
};
