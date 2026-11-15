// A calendar feed's link as Subscribe to Calendar shows and hands it on (docs/specs/026-plan/calendar-feed.md "The
// dialog"; blueprint calendar-feed.md "Interfaces and contracts"). Pure.

// Google Calendar's add-by-address page: it subscribes to the `webcal:` address in `cid`.
export const GOOGLE_SUBSCRIBE_BASE = 'https://calendar.google.com/calendar/r?cid=';

/** The full link from the path the api answers (`/api/calendar/…`), on the api's own origin. */
export function feedUrlOf(path: string, apiBase: string, here: string): string {
  return new URL(path, new URL(apiBase, here)).toString();
}

/** The link as a calendar app subscribes to it: `webcal:` in place of `https:` or `http:`. */
export function appleCalendarUrl(url: string): string {
  return url.replace(/^https?:/, 'webcal:');
}

/** Google Calendar's page that subscribes to the link. */
export function googleCalendarUrl(url: string): string {
  return `${GOOGLE_SUBSCRIBE_BASE}${encodeURIComponent(appleCalendarUrl(url))}`;
}
