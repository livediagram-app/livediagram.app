// Display helpers for dates and descriptions on the post page, and the app's nouns in a heading. Pure.

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatDate(timestamp: number): string {
  return DATE.format(new Date(timestamp));
}

// The description's paragraphs: blank lines separate them (publish collapses longer runs to one).
export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// A word as it starts a sentence or names a control in Title Case ("canvas" to "Canvas").
export function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
