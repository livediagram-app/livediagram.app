// The fix every finding ends with (blueprint "Presentation and UX", LN29): edit operations in the line form.
// `, or ` offers alternatives, and `<text>` is a placeholder.

export const fixes = {
  labelOverflow: (a: string, smaller: boolean) =>
    smaller ? `set ${a} text=sm` : `set ${a} label="<text>" note="<text>"`,
  // A card's title or subtitle cut short: the card widened to hold it.
  cardTextCut: (a: string, width: number) => `set ${a} width=${width}`,
  // A page's text: grown to hold its lines; two texts over each other moved apart.
  textOverflow: (a: string, height: number) => `set ${a} height=${height}`,
  textOverflowWidth: (a: string, width: number) => `set ${a} width=${width}`,
  textOverlap: (a: string, b: string) => `move ${b} below:${a}`,
};
