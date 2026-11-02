// A Community count as a card shows it (docs/specs/025-community/community.md "Gallery"): 999, 1.2K, 34K, short enough
// for a card footer. Shared by the Community app and the landing page so a count reads the same everywhere.
const COMPACT = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });

export function formatCommunityCount(n: number): string {
  return n < 1000 ? String(n) : COMPACT.format(n);
}
