import type { Metric } from './metric-series';

// Charts defined once and reused (spec/22). A chart stack references these
// rather than declaring its own copies, so one chart can sit in several
// stacks, on several tabs, or on its own, and its wording stays in one place.

export const NEW_VISITORS: Metric = {
  category: 'Participant',
  action: 'Created',
  type: null,
  title: 'New Visitors',
};

export const RETURNING_VISITORS: Metric = {
  category: 'Participant',
  action: 'Returned',
  allTypes: true,
  title: 'Returning Visitors',
  blurb:
    'Browsers that came back on a later day than their first visit, counted once per day. Sum of guests and signed-in users.',
};

export const SIGN_UPS: Metric = {
  category: 'Session',
  action: 'SignedUp',
  type: null,
  title: 'Sign-Ups',
};

export const SIGN_INS: Metric = {
  category: 'Session',
  action: 'SignedIn',
  type: null,
  title: 'Sign-Ins',
};

export const SIGN_OUTS: Metric = {
  category: 'Session',
  action: 'SignedOut',
  type: null,
  title: 'Sign-Outs',
};

export const ACCOUNTS_DELETED: Metric = {
  category: 'Session',
  action: 'Deleted',
  type: 'Account',
  title: 'Accounts Deleted',
  blurb: 'Signed-in users who deleted their account and all of its data.',
};

// Parked: cleared from Highlights (September 2026) while it is rebuilt, and on
// no other tab as a card, so kept here with their wording ready to add back.
// Search and Raw still show the underlying events.

export const ELEMENTS_ADDED: Metric = {
  category: 'Element',
  action: 'Added',
  allTypes: true,
  title: 'Elements Added',
  blurb:
    'Every shape, text, sticky, arrow, or image put on a canvas, across all kinds. Copies count too: a duplicate or paste adds one per element it creates.',
};

export const EXPORTS: Metric = {
  category: 'Diagram',
  action: 'Exported',
  allTypes: true,
  title: 'Exports',
  blurb:
    'A tab or selection exported, across every format (PNG, SVG, PDF, JSON, Mermaid, Markdown, Excalidraw). For the text formats, copying to the clipboard counts as an export too.',
};

export const DARK_MODE_SWITCHES: Metric = {
  category: 'UI',
  action: 'Toggled',
  type: 'Dark',
  title: 'Dark-Mode Switches',
  blurb: 'Someone set the editor appearance to Dark, from the header toggle or Settings.',
};
