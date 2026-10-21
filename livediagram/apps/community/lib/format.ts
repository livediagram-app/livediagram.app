// Display helpers for counts and dates on cards and the post page. Pure.

// 999, 1.2K, 34K: the shared Community count.

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
