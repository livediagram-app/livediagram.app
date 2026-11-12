// docs/specs/014-identity/transactional-email.md: the five email bodies. Plain, inline-styled, email-client-safe HTML
// (no external CSS, tables for layout where it matters). Each builder returns
// { subject, html }; links resolve against APP_BASE_URL via appBaseUrl(env).
// Content only: never a document's contents, only the user's own account facts
// plus a team name the inviter already chose.

import { xmlEscape } from '@liveworkspace/icons';
import {
  createEmailLayout,
  mentionQuote,
  notificationSettingsUrl,
  subjectText,
  type EmailSection,
} from '@liveworkspace/email/layout';
import type { Env } from '../types';
import { appBaseUrl } from './client';

export { MENTION_QUOTE_CHARS, mentionQuote } from '@liveworkspace/email/layout';

// The shared look (@liveworkspace/email/layout), in livediagram's brand.
const layout = createEmailLayout({
  brand: '#0ea5e9',
  wordmarkAccent: '#0284c7',
  bandGradient: 'linear-gradient(90deg,#38bdf8 0%,#0ea5e9 45%,#1d4ed8 100%)',
  canvas: '#f0f9ff',
  // `pnpm icons:brand` writes it into the marketing app's public/email/. 64px, 2x the slot.
  logoPath: '/email/livediagram-mark-64.png',
  wordmarkTail: 'diagram',
  tagline: 'Diagram, draw and run workshops together, live. Free and open source.',
  accountFooter:
    'You’re receiving this because you have a livediagram account. The editor is free and open source.',
});

// docs/specs/014-identity/transactional-email.md: footer for an opt-out notification email, the reason plus a link to
// the settings where the recipient can turn the category off in one click.
function manageNotificationsFooter(env: Env, reason: string): string {
  return layout.manageNotificationsFooter(appBaseUrl(env), reason);
}

// `kind` is the template's telemetry token (docs/specs/017-telemetry/telemetry.md 'Email' category): it rides
// along on the builder's return so it reaches `sendEmail` through the same
// spread every caller already writes, rather than being re-stated (and
// forgotten) at each call site. A fixed literal, never a
// subject line or anything the recipient wrote.
export type EmailKind =
  | 'Milestone'
  | 'FirstShare'
  | 'DocumentJoined'
  | 'CommentNotification'
  | 'ActionAssigned'
  | 'Mentioned'
  | 'FormResponse'
  | 'FormSuspended'
  | 'AccountDeleted';

export type RenderedEmail = {
  kind: EmailKind;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
};

// Where every opt-out category can be turned off, for the footer link and the List-Unsubscribe header.
function profilePath(env: Env): string {
  return notificationSettingsUrl(appBaseUrl(env));
}

function shell(env: Env, section: EmailSection): string {
  return layout.shell(appBaseUrl(env), section);
}

export function accountDeletedEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'AccountDeleted',
    subject: 'Your livediagram account has been deleted',
    html: shell(env, {
      heading: 'Your account has been deleted',
      intro:
        'This confirms that your livediagram documents and your liveworkspace account have been permanently removed, as you requested. The account is closed for every liveworkspace app. There’s nothing left for you to do.',
      outro:
        'If this wasn’t you, or you change your mind, you’re always welcome back. The canvas is free and needs no account to start.',
      ctaText: 'Start a new diagram',
      ctaHref: `${base}/new`,
      footer:
        'This is a one-time confirmation of your account deletion. We won’t send any further email to this address.',
    }),
  };
}

// docs/specs/014-identity/profile-and-email-notifications.md: a new person opened one of the owner's shared documents for the
// first time. Sent to the document OWNER, so the document name is their own
// content coming back to them (not a docs/specs/014-identity/transactional-email.md §7 leak). `joinerName` is the
// visitor's display name when known (already visible to the owner in live
// presence / the Shared list); null falls back to "Someone".
export function documentJoinedEmail(
  env: Env,
  documentName: string,
  joinerName: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const who = joinerName && joinerName.trim() ? escapeHtml(joinerName.trim()) : 'Someone';
  const named =
    documentName && documentName.trim() ? escapeHtml(documentName.trim()) : 'your document';
  const whoText = joinerName && joinerName.trim() ? escapeText(joinerName.trim()) : 'Someone';
  return {
    kind: 'DocumentJoined',
    subject: `${whoText} opened one of your documents`,
    html: shell(env, {
      heading: 'Someone joined your document',
      intro: `<strong>${who}</strong> just opened <strong>${named}</strong>, a document you shared. They can collaborate on it with the access you granted.`,
      outro:
        'Join notifications are on by default for documents you share. You can turn them off any time in your notification settings.',
      ctaText: 'Open the document',
      ctaHref: `${base}/explorer`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone opened a document you shared.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/012-collaboration/assigned-actions.md: someone assigned the recipient an action on a document element.
// Sent to the assignee (a joined teammate of the assigner). Opt-out
// (notifyActionAssigned). Everything user-influenced here (assigner name,
// document name, action name, description) is either the assigner's own words
// being delivered on their behalf or a document/team fact the two already
// share (docs/specs/014-identity/transactional-email.md §7), and all of it is escaped.
const ACTION_DESCRIPTION_PREVIEW_CHARS = 200;

export function actionAssignedEmail(
  env: Env,
  assignerName: string | null,
  // Null when the assignee cannot open the document (docs/specs/012-collaboration/assigned-actions.md §4): the
  // email names no document and its button opens the Explorer instead of a page they would be refused.
  document: { id: string; name: string } | null,
  actionName: string,
  description: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const who = assignerName && assignerName.trim() ? escapeHtml(assignerName.trim()) : 'A teammate';
  const whoText =
    assignerName && assignerName.trim() ? escapeText(assignerName.trim()) : 'A teammate';
  const liveDoc =
    document && document.name.trim() ? escapeHtml(document.name.trim()) : 'a shared document';
  const action = escapeHtml(actionName.trim());
  const detail = description?.trim()
    ? escapeHtml(
        description.trim().length > ACTION_DESCRIPTION_PREVIEW_CHARS
          ? `${description.trim().slice(0, ACTION_DESCRIPTION_PREVIEW_CHARS)}…`
          : description.trim(),
      )
    : null;
  const intro = document
    ? `<strong>${who}</strong> assigned you an action on <strong>${liveDoc}</strong>: <strong>${action}</strong>.`
    : `<strong>${who}</strong> assigned you an action: <strong>${action}</strong>. You can’t open its document yet, so ask them to share it with you.`;
  return {
    kind: 'ActionAssigned',
    subject: `${whoText} assigned you an action`,
    html: shell(env, {
      heading: 'You have a new action',
      intro,
      ...(detail ? { outro: detail } : {}),
      ...(document
        ? {
            ctaText: 'Open the document',
            ctaHref: `${base}/document/${encodeURIComponent(document.id)}`,
          }
        : { ctaText: 'Open livediagram', ctaHref: `${base}/explorer` }),
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a teammate assigned you an action.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/012-collaboration/comment-mentions.md: a teammate @-mentioned the recipient in a comment. The
// author and document name come from server state (the notify-mention route);
// the quote is the author's own words, escaped and cut at a word.
export function mentionedEmail(
  env: Env,
  authorName: string | null,
  documentName: string,
  documentId: string,
  commentText: string,
): RenderedEmail {
  const base = appBaseUrl(env);
  const docHref = `${base}/document/${encodeURIComponent(documentId)}`;
  const who = authorName && authorName.trim() ? escapeHtml(authorName.trim()) : 'A teammate';
  const whoText = authorName && authorName.trim() ? escapeText(authorName.trim()) : 'A teammate';
  const liveDoc =
    documentName && documentName.trim() ? escapeHtml(documentName.trim()) : 'a shared document';
  const documentText =
    documentName && documentName.trim() ? escapeText(documentName.trim()) : 'a document';
  return {
    kind: 'Mentioned',
    subject: `${whoText} mentioned you in ${documentText}`,
    html: shell(env, {
      heading: 'You were mentioned',
      intro: `<strong>${who}</strong> mentioned you in a comment on <strong>${liveDoc}</strong>:`,
      outro: `“${escapeHtml(mentionQuote(commentText))}”`,
      ctaText: 'Open the document',
      ctaHref: docHref,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a teammate mentioned you in a comment.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// Escaping for the one piece of user-influenced text in an email body (the
// team name): the repo's one markup escaper for the body, and a plain-text
// variant for the subject line. A local copy used to skip the apostrophe.
const escapeHtml = xmlEscape;

const escapeText = subjectText;

// docs/specs/014-identity/transactional-email.md (#1): someone other than the owner left a comment on a document the
// recipient owns. Opt-out (notifyComments). Never includes the comment text
// (privacy): just who, which document, and a link to open it.
export function commentNotificationEmail(
  env: Env,
  documentName: string,
  documentId: string,
  commenterName: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const whoText =
    commenterName && commenterName.trim() ? escapeText(commenterName.trim()) : 'Someone';
  const nameText =
    documentName && documentName.trim() ? escapeText(documentName.trim()) : 'your document';
  const who = commenterName && commenterName.trim() ? escapeHtml(commenterName.trim()) : 'Someone';
  const name =
    documentName && documentName.trim() ? escapeHtml(documentName.trim()) : 'your document';
  return {
    kind: 'CommentNotification',
    subject: `${whoText} commented on ${nameText}`,
    html: shell(env, {
      heading: 'New comment on your document',
      intro: `<strong>${who}</strong> left a comment on <strong>${name}</strong>. Open the document to read it and reply.`,
      ctaText: 'Open the document',
      ctaHref: `${base}/document/${encodeURIComponent(documentId)}`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone commented on a document you own.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/014-identity/transactional-email.md (#6): a small celebration when an owner reaches a document-count
// milestone. Opt-out (notifyMilestones).
export function milestoneEmail(env: Env, count: number): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'Milestone',
    subject: `You’ve made ${count} documents on livediagram`,
    html: shell(env, {
      heading: `That’s ${count} documents`,
      intro: `Nice work, you’ve created <strong>${count}</strong> documents on livediagram. Thanks for building with us.`,
      outro: 'Here’s to the next one.',
      ctaText: 'Open your Explorer',
      ctaHref: `${base}/explorer`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because you reached a milestone and milestone emails are on.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/014-identity/transactional-email.md (#6): the first time an owner creates a share link. Opt-out
// (notifyMilestones), same category as the document-count milestone.
export function firstShareEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'FirstShare',
    subject: 'You shared your first document',
    html: shell(env, {
      heading: 'Your first shared document',
      preheader: 'Anyone with the link can open it now, and you stay in control.',
      intro:
        'Nice work, you just shared a document for the first time. Anyone with the link can open it, and you stay in control:',
      points: [
        'Hand out a <strong>view-only</strong> or an <strong>editor</strong> link, whichever fits.',
        'Set a link to <strong>expire</strong> after a week, a month, or six months.',
        'Revoke a link any time from the Share dialog, and it stops working instantly.',
      ],
      outro:
        'Collaboration needs no account, so whoever you share with can jump straight onto the canvas.',
      ctaText: 'Open your Explorer',
      ctaHref: `${base}/explorer`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because you reached a milestone and milestone emails are on.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}
