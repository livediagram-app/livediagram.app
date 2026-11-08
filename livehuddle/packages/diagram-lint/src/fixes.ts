// The fix every finding ends with (blueprint "Presentation and UX", LN29): edit operations in the line
// form. `; ` runs them in order, `, or ` offers alternatives, and `<ref>` and `<text>` are placeholders.

export const fixes = {
  labelOverflow: (a: string, smaller: boolean) =>
    smaller ? `set ${a} text=sm` : `set ${a} label="<text>" note="<text>"`,
  // Two texts over each other moved apart.
  textOverlap: (a: string, b: string) => `move ${b} below:${a}`,
  duplicateLabel: (b: string) => `set ${b} label="<text>"`,
  colourOnThemed: (a: string, fields: readonly ('fill' | 'stroke')[]) =>
    `set ${a} ${fields.map((f) => `${f}=`).join(' ')}`,
};
