// The element format in brief, as each tool that takes elements carries it (each product's
// docs/specs/015-api/mcp-server.md §4.18 "The element format, once"): the whole format is the product's schema
// resource, and a tool says enough for a first call without it, never pointing at another tool.

// A style field with this many values or fewer is listed with them; a longer list (the fonts, the BPMN symbols, the
// arrowheads) is named alone, its values in the resource and in the refusal of a value off it.
export const BRIEF_VALUES_MAX = 6;

/** The style fields by name, the short closed lists with their values. */
export function styleFieldsBrief(values: Readonly<Record<string, readonly string[]>>): string {
  const fields = Object.entries(values).map(([key, list]) =>
    list.length <= BRIEF_VALUES_MAX ? `"${key}" (${list.join(', ')})` : `"${key}"`,
  );
  return (
    `Style fields: ${fields.join(', ')}; "textBold", "textItalic" (true/false), "colorPreset" (a look from ` +
    'the theme), "iconId" (an id from search_icons). '
  );
}

/** Where the rest of the format is, and what a field or value off it gets: a refusal that teaches. */
export function elementFormatPointer(resourceUri: string): string {
  return (
    `Every option of these kinds, and the values of the style fields named without them, are in the schema ` +
    `resource ${resourceUri}. A field a kind does not have, or a value off its list, is refused naming what it ` +
    'takes.'
  );
}
