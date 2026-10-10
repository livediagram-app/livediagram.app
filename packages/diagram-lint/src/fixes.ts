// The fix every finding ends with (blueprint "Presentation and UX", LN29). A tab fix is edit operations
// in the line form: `; ` runs them in order, `, or ` offers alternatives, and `<ref>` and `<text>` are
// placeholders. A graph fix is a change to the source, in words or as a command.

import type { LintSource } from './context';

const pick = (source: LintSource, tab: string, graph: string) => (source === 'tab' ? tab : graph);

export const fixes = {
  boxOverlap: (s: LintSource, a: string, b: string) =>
    pick(s, `move ${b} right-of:${a}`, 'graph lint --compare direction,groups'),
  arrowDangling: (s: LintSource, arrow: string) => pick(s, `rm ${arrow}`, 'remove the edge'),
  arrowBehindBox: (s: LintSource, arrow: string, angled: boolean) =>
    pick(
      s,
      `set ${arrow} line=${angled ? 'curved' : 'angled'}`,
      'drop the groups, or lines: angled',
    ),
  edgeCrossings: (s: LintSource) =>
    pick(s, 'layout type:shape', 'graph lint --compare direction,groups,lines'),
  labelCollision: (s: LintSource, arrow: string) =>
    pick(s, `set ${arrow} label="<text>"`, 'shorten the edge label'),
  labelOverflow: (s: LintSource, a: string, smaller: boolean) =>
    pick(
      s,
      smaller ? `set ${a} text=sm` : `set ${a} label="<text>" note="<text>"`,
      'shorten the label; detail goes in note',
    ),
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
