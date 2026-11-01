// A name in a sentence, isolated (FSI … PDI): a right-to-left name, or one holding a bidi override (an item's title
// is whatever its app took), stays where it is and never turns the words after it around ("Moved “Budget evil” to
// the Trash.", not "Moved “Budget .hsarT eht ot ”live").
export const isolated = (name: string): string => `⁨${name}⁩`;

// The same in curly quotes, for an item's or a picture's name.
export const quoted = (name: string): string => `“${isolated(name)}”`;
