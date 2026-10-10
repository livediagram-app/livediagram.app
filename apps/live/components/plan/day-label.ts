// A card's calendar dates, `YYYY-MM-DD`, as Plan shows and compares them
// (docs/specs/004-interface-design/date-fields.md "Showing a date").

const FORMATS = {
  // A board card, where room is tight: "30 Oct".
  short: { day: 'numeric', month: 'short' },
  // The card panel and its custom fields: "30 Oct 2026".
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  // A card's slide: "30 October 2026".
  long: { day: 'numeric', month: 'long', year: 'numeric' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DayLabelStyle = keyof typeof FORMATS;

// One formatter per style, made on first use: a board labels every card's dates on each render, and
// `toLocaleDateString` builds a formatter per call (2000 labels: 65 ms against 12 ms cached).
const formatters = new Map<DayLabelStyle, Intl.DateTimeFormat>();

// A saved day in the viewer's locale; a value that is not a day reads as it is.
export function dayLabel(day: string, style: DayLabelStyle = 'short'): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  let f = formatters.get(style);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, FORMATS[style]);
    formatters.set(style, f);
  }
  return f.format(d);
}

// The viewer's own calendar day, `offset` days from today: local, never UTC, so it does not
// slip a day either side of midnight.
export function dayKey(offset = 0, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
