// Request Access's two emails (liveworkspace/docs/specs/004-index/request-access.md "The emails"), worded once for
// every app: someone asked a manager for access to an item, and a manager shared it with the person who asked. Each
// app binds them to its own look (`createEmailLayout`), its noun and its addresses (its email/templates.ts); the
// sending is @liveworkspace/index-app's notifier. Every name, title and note here is someone's own text, escaped with
// the app's escape before it reaches the HTML; the subject takes the plain, one-line form (`subjectText`).

import { mentionQuote, subjectText, type EmailSection } from './layout';

/** The levels a grant can give, as the index names them. */
export type AccessLevel = 'edit' | 'participate' | 'view';

/** What an app binds the words to: its word for an item ('canvas', 'plan') and its HTML escape. */
export type AccessEmailWords = { noun: string; escape: (text: string) => string };

/** An email's words: its subject, its section (the app adds the footer) and the footer's reason. */
export type AccessEmailParts = {
  subject: string;
  section: Omit<EmailSection, 'footer'>;
  /** Why the recipient gets it, for the app's footer. */
  reason: string;
};

const LEVEL_TITLE: Record<AccessLevel, string> = {
  edit: 'an Editor',
  participate: 'a Participant',
  view: 'a Viewer',
};

const trimmed = (text: string | null | undefined): string | null => text?.trim() || null;

/** A manager's email: someone asked for access to an item they manage. `href` opens the Inbox on the request. */
export function accessRequestedParts(
  input: { requesterName: string | null; itemTitle: string; note: string | null; href: string },
  { noun, escape }: AccessEmailWords,
): AccessEmailParts {
  const name = trimmed(input.requesterName);
  const title = trimmed(input.itemTitle);
  const note = trimmed(input.note);
  const who = name ? escape(name) : 'Someone';
  const item = title ? escape(title) : `your ${noun}`;
  return {
    subject: `${name ? subjectText(name) : 'Someone'} asked for access to ${title ? subjectText(title) : `your ${noun}`}`,
    section: {
      heading: 'Someone asked for access',
      intro: `<strong>${who}</strong> asked for access to <strong>${item}</strong>. Share it with them from your Inbox in one click, or decline. They hear nothing unless you share it.`,
      ...(note ? { outro: `“${escape(mentionQuote(note))}”` } : {}),
      ctaText: 'Review the Request',
      ctaHref: input.href,
    },
    reason: `You’re receiving this because someone asked for access to a ${noun} you manage.`,
  };
}

/** The requester's email: a manager shared the item with them. `href` opens the item. */
export function accessGrantedParts(
  input: { granterName: string | null; itemTitle: string; level: AccessLevel; href: string },
  { noun, escape }: AccessEmailWords,
): AccessEmailParts {
  const name = trimmed(input.granterName);
  const title = trimmed(input.itemTitle);
  const who = name ? escape(name) : 'Someone';
  const item = title ? escape(title) : `a ${noun}`;
  return {
    subject: `${name ? subjectText(name) : 'Someone'} shared ${title ? subjectText(title) : `a ${noun}`} with you`,
    section: {
      heading: 'You have access',
      intro: `<strong>${who}</strong> shared <strong>${item}</strong> with you, as you asked. You can open it as ${LEVEL_TITLE[input.level]}, and it is in your Shared With Me.`,
      ctaText: `Open the ${noun}`,
      ctaHref: input.href,
    },
    reason: `You’re receiving this because you asked for access to this ${noun}.`,
  };
}
