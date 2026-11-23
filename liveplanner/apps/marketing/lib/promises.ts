// The landing page's promises (docs/specs/019-marketing/marketing-site.md "Promises"): four things
// that are true of liveplanner today, under the page's golden rule (no claim the product does not
// keep). The site is international, so no promise names a currency. Each has a title, set in its own light, one line, and, where there is more to read, a
// link. The art and hues live with the component (components/PromiseCanvas.tsx).

export type PromiseId = 'no-account' | 'export' | 'private' | 'live';

export type Promise = {
  id: PromiseId;
  // Set large in the card's hue. No Account Needed has none: its title says it all.
  title: string;
  line: string;
  link?: { href: string; label: string; external?: boolean };
};

export const PROMISES: readonly Promise[] = [
  {
    id: 'no-account',
    title: 'No Account Needed',
    line: 'Open the editor and start. Sign in later, only if you want to sync.',
  },
  {
    id: 'export',
    title: 'Your Work, Yours',
    line: 'Export boards and sheets as CSV, images, PDF or Markdown, whenever you like.',
    link: { href: '/help/tabs/export-tabs/', label: 'How export works' },
  },
  {
    id: 'private',
    title: 'Private by Design',
    line: 'No ads and no third-party analytics, only anonymous first-party counts.',
    link: { href: '#privacy', label: 'How we handle data' },
  },
  {
    id: 'live',
    title: 'Real-Time Collaboration',
    line: 'Share a link and plan together, cursors and edits in sync.',
  },
];
