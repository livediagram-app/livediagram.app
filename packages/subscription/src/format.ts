// How a limit's raw number reads (subscription.md "Tiers and limits"), apart from the comparison's rows so a page
// that only words a size (an upload's limit) carries none of the table.

export const NUMBER = new Intl.NumberFormat('en-GB');

/** 500 MB, 50 GB: decimal units, as the tiers are written. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${NUMBER.format(Math.round((bytes / 1e9) * 10) / 10)} GB`;
  return `${NUMBER.format(Math.round(bytes / 1e6))} MB`;
}

/** 7 days, 30 days, 1 year. */
export function formatDays(days: number): string {
  if (days > 0 && days % 365 === 0) return days === 365 ? '1 year' : `${days / 365} years`;
  return days === 1 ? '1 day' : `${NUMBER.format(days)} days`;
}
