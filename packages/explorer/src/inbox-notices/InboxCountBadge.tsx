// The Inbox's count on the editor's Explorer button (inbox-notices.md "The count"): the sidebar's count, as a small
// brand pill over the button's top right corner, 9+ past nine, nothing at 0 or while unread. Decorative: the button's
// own name says it (`inboxButtonLabel`).

import { CountBadge } from '@liveworkspace/ui';

export const INBOX_BADGE_MAX = 9;

export const inboxBadgeText = (count: number) =>
  count > INBOX_BADGE_MAX ? `${INBOX_BADGE_MAX}+` : String(count);

/** The button's name with the count: "Explorer, 3 in Inbox". */
export const inboxButtonLabel = (name: string, count: number | undefined) =>
  count ? `${name}, ${inboxBadgeText(count)} in Inbox` : name;

export function InboxCountBadge({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <span
      aria-hidden="true"
      data-inbox-count=""
      className="pointer-events-none absolute -right-1 -top-1 rounded-full ring-2 ring-white dark:ring-slate-900"
    >
      <CountBadge tone="brand" size="sm">
        {inboxBadgeText(count)}
      </CountBadge>
    </span>
  );
}
