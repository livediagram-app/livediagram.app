// The fix every finding ends with (blueprint "Presentation and UX", LN29): edit operations in the line
// form. `; ` runs them in order, `, or ` offers alternatives, and `<ref>` and `<text>` are placeholders.

export const fixes = {
  boxOverlap: (a: string, b: string) => `move ${b} right-of:${a}`,
  arrowDangling: (arrow: string) => `rm ${arrow}`,
  // A style whose route clears every box, else advice: a style suggested blind passed behind another box, and the
  // next lint suggested the style back.
  arrowBehindBox: (
    arrow: string,
    style: string | null,
    move: { box: string; by: { dx: number; dy: number } },
  ) => (style ? `set ${arrow} line=${style}` : `move ${move.box} by=${move.by.dx},${move.by.dy}`),
  // `layout` lays out shapes alone, so on a tab with stacks it would leave them behind: there the fix
  // reroutes the most-crossed arrow instead.
  // On such a tab, a line style for one of the most-crossed arrows that strictly lowers its crossings, else advice:
  // a style suggested blind added crossings, and the next lint then suggested the style back.
  edgeCrossings: (contained: { arrow: string; style: string | null } | null) =>
    contained
      ? contained.style
        ? `set ${contained.arrow} line=${contained.style}`
        : `move a box so ${contained.arrow} crosses fewer lines`
      : 'layout type:shape',
  labelCollision: (arrow: string, fits: number) =>
    `set ${arrow} label="<at most ${fits} characters>"`,
  // A struck label moved along its own line to a spot clear of every other line and box.
  labelStruck: (arrow: string, t: number) => `set ${arrow} labelOffset={"t":${t},"offset":0}`,
  labelOverflow: (a: string, smaller: boolean) =>
    smaller ? `set ${a} text=sm` : `set ${a} label="<text>" note="<text>"`,
  // A card's title or subtitle cut short: the card widened to hold it.
  cardTextCut: (a: string, width: number) => `set ${a} width=${width}`,
  // A page's text: grown to hold its lines; two texts over each other moved apart.
  textOverflow: (a: string, height: number) => `set ${a} height=${height}`,
  textOverflowWidth: (a: string, width: number) => `set ${a} width=${width}`,
  textOverlap: (a: string, b: string) => `move ${b} below:${a}`,
  nodeIsolated: (a: string) => `connect <ref> -> ${a}`,
  duplicateLabel: (b: string) => `set ${b} label="<text>"`,
  // Both ends in one rewire: one end at a time would pass through a self-loop, which rewire refuses.
  flowBackwards: (arrow: string, x: string, y: string) => `rewire ${arrow} from=${y} to=${x}`,
};
