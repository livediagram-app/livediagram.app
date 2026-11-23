// docs/specs/014-identity/transactional-email.md: the email bodies. Plain, inline-styled, email-client-safe HTML
// (no external CSS, tables for layout where it matters). Each builder returns
// { subject, html }; links resolve against APP_BASE_URL via appBaseUrl(env).
// Content only: never a document's contents, only the user's own account facts
// plus a team name the inviter already chose.

import { xmlEscape } from '@liveworkspace/icons';
import { mentionQuote, subjectText } from '@liveworkspace/email/layout';
import { accessGrantedParts, accessRequestedParts } from '@liveworkspace/email/access-request';
import type {
  AccessGrantedEmailInput,
  AccessRequestedEmailInput,
  ApprovalEmailInput,
} from '@liveworkspace/index-app';
import type { Env } from '../types';
import { manageNotificationsFooter, profilePath, shell } from './brand-layout';
import { appBaseUrl } from './client';

export { MENTION_QUOTE_CHARS, mentionQuote } from '@liveworkspace/email/layout';

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
  | 'ApprovalRequested'
  | 'AccessRequested'
  | 'AccessGranted'
  | 'Mentioned'
  | 'AccountDeleted'
  // The Knowledgebase Reviews notices (knowledge-templates.ts).
  | 'ReviewDue'
  | 'PagesDisagree'
  | 'OwnersReminded'
  // A page its owner answers for was rejected (docs/specs/030-knowledgebase/approval.md "Email").
  | 'PageRejected'
  // What changed on the pages someone watches, once a day (docs/specs/030-knowledgebase/watching.md).
  | 'WatchDigest'
  // Remind on a Required Reading page (docs/specs/030-knowledgebase/required-reading.md "Remind").
  | 'ReadingReminder'
  // A rule's Send Email (docs/specs/013-workspace/automations.md; @liveworkspace/automations/room email.ts).
  | 'AutomationEmail';

export type RenderedEmail = {
  kind: EmailKind;
  subject: string;
  html: string;
  // The plain-text alternative, for the emails that carry one.
  text?: string;
  unsubscribeUrl?: string;
};

export function accountDeletedEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'AccountDeleted',
    subject: 'Your liveknowledge account has been deleted',
    html: shell(env, {
      heading: 'Your account has been deleted',
      intro:
        'This confirms that your liveknowledge documents and your liveworkspace account have been permanently removed, as you requested. The account is closed for every liveworkspace app. There’s nothing left for you to do.',
      outro:
        'If this wasn’t you, or you change your mind, you’re always welcome back. liveknowledge is free and needs no account to start.',
      ctaText: 'Start a new document',
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
        : { ctaText: 'Open liveknowledge', ctaHref: `${base}/explorer` }),
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a teammate assigned you an action.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/012-collaboration/comment-mentions.md: a teammate @-mentioned the recipient in a comment. The
// author and document name come from server state (the document the comment is on);
// the quote is the author's own words, escaped and cut at a word.
// Someone asked the recipient to approve a document (liveworkspace/docs/specs/004-index/approvals.md "The email"):
// who asked, the document, the day hoped for and their note. Opt-out with assigned actions (notifyActionAssigned).
export function approvalRequestedEmail(env: Env, input: ApprovalEmailInput): RenderedEmail {
  const base = appBaseUrl(env);
  const name = input.requesterName?.trim();
  const who = name ? escapeHtml(name) : 'A teammate';
  const whoText = name ? escapeText(name) : 'A teammate';
  const title = input.item.name.trim();
  const item = title ? escapeHtml(title) : 'a shared document';
  const itemText = title ? escapeText(title) : 'a document';
  const due = input.due ? APPROVAL_DUE.format(new Date(`${input.due}T00:00:00Z`)) : null;
  const note = input.note?.trim()
    ? escapeHtml(
        input.note.trim().length > ACTION_DESCRIPTION_PREVIEW_CHARS
          ? `${input.note.trim().slice(0, ACTION_DESCRIPTION_PREVIEW_CHARS)}…`
          : input.note.trim(),
      )
    : null;
  return {
    kind: 'ApprovalRequested',
    subject: `${whoText} asked you to approve ${itemText}`,
    html: shell(env, {
      heading: 'Your approval is requested',
      intro: `<strong>${who}</strong> asked you to approve <strong>${item}</strong>${due ? ` by <strong>${due}</strong>` : ''}. Open it to approve it or request changes.`,
      ...(note ? { outro: note } : {}),
      ctaText: 'Review the document',
      ctaHref: `${base}/document/${encodeURIComponent(input.item.id)}`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a teammate asked you to approve their work.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// A due day as the email says it ("20 November 2026"), read as the calendar day it names.
const APPROVAL_DUE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

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
  // Written by an agent with the commenter's access: said as Generated by AI (agent-presence.md "Comments").
  ai = false,
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
    subject: `${whoText} commented on ${nameText}${ai ? ' (Generated by AI)' : ''}`,
    html: shell(env, {
      heading: 'New comment on your document',
      intro: `<strong>${who}</strong> left a comment on <strong>${name}</strong>. ${ai ? 'The comment is marked <strong>Generated by AI</strong>: an AI assistant wrote it with their access. ' : ''}Open the document to read it and reply.`,
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
    subject: `You’ve made ${count} documents on liveknowledge`,
    html: shell(env, {
      heading: `That’s ${count} documents`,
      intro: `Nice work, you’ve created <strong>${count}</strong> documents on liveknowledge. Thanks for building with us.`,
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
        'Collaboration needs no account, so whoever you share with can jump straight into the document.',
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

// Request Access (liveworkspace/docs/specs/004-index/request-access.md "The emails"), worded once
// (@liveworkspace/email/access-request) in this app's look: someone asked for access to a document the recipient manages
// (opt-out with the join switch), and a manager shared it with the person who asked (no switch: they asked for it).
const ACCESS_WORDS = { noun: 'document', escape: xmlEscape };

export function accessRequestedEmail(env: Env, input: AccessRequestedEmailInput): RenderedEmail {
  const inbox = `${appBaseUrl(env)}/explorer/inbox?at=${encodeURIComponent(`r:${input.requestId}`)}`;
  const parts = accessRequestedParts(
    {
      requesterName: input.requesterName,
      itemTitle: input.item.name,
      note: input.note,
      href: inbox,
    },
    ACCESS_WORDS,
  );
  return {
    kind: 'AccessRequested',
    subject: parts.subject,
    html: shell(env, { ...parts.section, footer: manageNotificationsFooter(env, parts.reason) }),
    unsubscribeUrl: profilePath(env),
  };
}

export function accessGrantedEmail(env: Env, input: AccessGrantedEmailInput): RenderedEmail {
  const parts = accessGrantedParts(
    {
      granterName: input.granterName,
      itemTitle: input.item.name,
      level: input.level,
      href: `${appBaseUrl(env)}/document/${encodeURIComponent(input.item.id)}`,
    },
    ACCESS_WORDS,
  );
  return {
    kind: 'AccessGranted',
    subject: parts.subject,
    html: shell(env, { ...parts.section, footer: parts.reason }),
  };
}
