import { relativeSince } from '../relative-time';
import { DAY_MS } from '@livediagram/items';

const MONTH_DAYS = 30;
const YEAR_DAYS = 365;

// When a Community post was shared, as a card says it (docs/specs/025-community/community.md "Gallery"):
// the editor's relative wording ("just now", "3 hours ago", "yesterday", "12 days ago") for the first month,
// then whole months, then whole years, since "214 days ago" is harder to read than "7 months ago".
export function communitySharedAgo(timestamp: number, now: number): string {
  const days = Math.floor((now - timestamp) / DAY_MS);
  if (days < MONTH_DAYS) return relativeSince(timestamp, now);
  if (days < YEAR_DAYS) {
    const months = Math.floor(days / MONTH_DAYS);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(days / YEAR_DAYS);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
