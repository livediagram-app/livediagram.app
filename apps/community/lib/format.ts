// Display helpers for counts and dates on cards and the post page. Pure.

const COMPACT = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });

// 999, 1.2K, 34K: short enough for a card footer.
export function formatCount(n: number): string {
  return n < 1000 ? String(n) : COMPACT.format(n);
}

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

// The author's initial for the coloured disc when they have no picture.
export function initialOf(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}
