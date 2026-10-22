// The landing page's promises (docs/specs/019-marketing/marketing-site.md "Promises"): five things
// that are true of liveplanner today, under the page's golden rule (no claim the product does not
// keep). The site is international, so no value names a currency. Each has a short value set large, a title, one line, and, where there is more to read, a
// link. The art and hues live with the component (components/PromiseCanvas.tsx).

export type PromiseId = 'free' | 'no-account' | 'export' | 'private' | 'live';

export type Promise = {
  id: PromiseId;
  value: string;
  title: string;
  line: string;
  link?: { href: string; label: string; external?: boolean };
};

export const PROMISES: readonly Promise[] = [
  {
    id: 'free',
    value: '0 paywalls',
    title: 'Completely Free',
    line: 'Every feature, for everyone. No paid tier and no trial clock.',
  },
  {
    id: 'no-account',
    value: '0 forms',
    title: 'No Account Needed',
    line: 'Open the editor and start. Sign in later, only if you want to sync.',
  },
  {
    id: 'export',
    value: '0 lock-in',
    title: 'Your Work, Yours',
    line: 'Export boards and sheets as CSV, images, PDF or Markdown, whenever you like.',
    link: { href: '/help/tabs/export-tabs/', label: 'How export works' },
  },
  {
    id: 'private',
    value: '0 trackers',
    title: 'Private by Design',
    line: 'No ads and no third-party analytics, only anonymous first-party counts.',
    link: { href: '#privacy', label: 'How we handle data' },
  },
  {
    id: 'live',
    value: 'Live',
    title: 'Real-Time Collaboration',
    line: 'Share a link and plan together, cursors and edits in sync.',
  },
];
