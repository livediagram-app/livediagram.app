// docs/specs/014-identity/transactional-email.md: the email bodies livedesign sends. Plain, inline-styled, email-client-safe HTML
// (no external CSS, tables for layout where it matters). Each builder returns
// { subject, html }; links resolve against APP_BASE_URL via appBaseUrl(env).
// Content only: never a design's contents, only the user's own account facts
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

// The shared look (@liveworkspace/email/layout), in livedesign's brand.
const layout = createEmailLayout({
  // brand-700: it carries the button's white text and the links' text, and white on
  // rose-500 is 2.2:1 where brand-700 clears AA at 5.9:1.
  brand: '#be123c',
  wordmarkAccent: '#be123c',
  bandGradient: 'linear-gradient(90deg,#fb7185 0%,#f43f5e 45%,#be185d 100%)',
  canvas: '#fff1f2',
  // `pnpm icons:brand` writes it into the marketing app's public/email/. 64px, 2x the slot.
  logoPath: '/email/livedesign-mark-64.png',
  wordmarkTail: 'design',
  tagline: 'Design logos and wireframes together, live. Free and open source.',
  accountFooter:
    'You’re receiving this because you have a livedesign account. The editor is free and open source.',
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
  | 'DesignJoined'
  | 'CommentNotification'
  | 'ActionAssigned'
  | 'Mentioned'
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
    subject: 'Your livedesign account has been deleted',
    html: shell(env, {
      heading: 'Your account has been deleted',
      intro:
        'This confirms that your livedesign designs and your liveworkspace account have been permanently removed, as you requested. The account is closed for every liveworkspace app. There’s nothing left for you to do.',
      outro:
        'If this wasn’t you, or you change your mind, you’re always welcome back. The canvas is free and needs no account to start.',
      ctaText: 'Start a new design',
      ctaHref: `${base}/new`,
      footer:
        'This is a one-time confirmation of your account deletion. We won’t send any further email to this address.',
    }),
  };
}

// docs/specs/014-identity/profile-and-email-notifications.md: a new person opened one of the owner's shared designs for the
// first time. Sent to the design OWNER, so the design name is their own
// content coming back to them (not a docs/specs/014-identity/transactional-email.md §7 leak). `joinerName` is the
// visitor's display name when known (already visible to the owner in live
// presence / the Shared list); null falls back to "Someone".
export function designJoinedEmail(
  env: Env,
  designName: string,
  joinerName: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const who = joinerName && joinerName.trim() ? escapeHtml(joinerName.trim()) : 'Someone';
  const named = designName && designName.trim() ? escapeHtml(designName.trim()) : 'your design';
  const whoText = joinerName && joinerName.trim() ? escapeText(joinerName.trim()) : 'Someone';
  return {
    kind: 'DesignJoined',
    subject: `${whoText} opened one of your designs`,
    html: shell(env, {
      heading: 'Someone joined your design',
      intro: `<strong>${who}</strong> just opened <strong>${named}</strong>, a design you shared. They can collaborate on it with the access you granted.`,
      outro:
        'Join notifications are on by default for designs you share. You can turn them off any time in your notification settings.',
      ctaText: 'Open the design',
      ctaHref: `${base}/explorer`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone opened a design you shared.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/012-collaboration/assigned-actions.md: someone assigned the recipient an action on a design element.
// Sent to the assignee (a joined teammate of the assigner). Opt-out
// (notifyActionAssigned). Everything user-influenced here (assigner name,
// design name, action name, description) is either the assigner's own words
// being delivered on their behalf or a design/team fact the two already
// share (docs/specs/014-identity/transactional-email.md §7), and all of it is escaped.
const ACTION_DESCRIPTION_PREVIEW_CHARS = 200;

export function actionAssignedEmail(
  env: Env,
  assignerName: string | null,
  // Null when the assignee cannot open the design (docs/specs/012-collaboration/assigned-actions.md §4): the
  // email names no design and its button opens the Explorer instead of a page they would be refused.
  design: { id: string; name: string } | null,
  actionName: string,
  description: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const who = assignerName && assignerName.trim() ? escapeHtml(assignerName.trim()) : 'A teammate';
  const whoText =
    assignerName && assignerName.trim() ? escapeText(assignerName.trim()) : 'A teammate';
  const liveDoc = design && design.name.trim() ? escapeHtml(design.name.trim()) : 'a shared design';
  const action = escapeHtml(actionName.trim());
  const detail = description?.trim()
    ? escapeHtml(
        description.trim().length > ACTION_DESCRIPTION_PREVIEW_CHARS
          ? `${description.trim().slice(0, ACTION_DESCRIPTION_PREVIEW_CHARS)}…`
          : description.trim(),
      )
    : null;
  const intro = design
    ? `<strong>${who}</strong> assigned you an action on <strong>${liveDoc}</strong>: <strong>${action}</strong>.`
    : `<strong>${who}</strong> assigned you an action: <strong>${action}</strong>. You can’t open its design yet, so ask them to share it with you.`;
  return {
    kind: 'ActionAssigned',
    subject: `${whoText} assigned you an action`,
    html: shell(env, {
      heading: 'You have a new action',
      intro,
      ...(detail ? { outro: detail } : {}),
      ...(design
        ? {
            ctaText: 'Open the design',
            ctaHref: `${base}/design/${encodeURIComponent(design.id)}`,
          }
        : { ctaText: 'Open livedesign', ctaHref: `${base}/explorer` }),
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a teammate assigned you an action.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/012-collaboration/comment-mentions.md: a teammate @-mentioned the recipient in a comment. The
// author and design name come from server state (the comment post and tab save);
// the quote is the author's own words, escaped and cut at a word.
export function mentionedEmail(
  env: Env,
  authorName: string | null,
  designName: string,
  designId: string,
  commentText: string,
): RenderedEmail {
  const base = appBaseUrl(env);
  const docHref = `${base}/design/${encodeURIComponent(designId)}`;
  const who = authorName && authorName.trim() ? escapeHtml(authorName.trim()) : 'A teammate';
  const whoText = authorName && authorName.trim() ? escapeText(authorName.trim()) : 'A teammate';
  const liveDoc =
    designName && designName.trim() ? escapeHtml(designName.trim()) : 'a shared design';
  const designText = designName && designName.trim() ? escapeText(designName.trim()) : 'a design';
  return {
    kind: 'Mentioned',
    subject: `${whoText} mentioned you in ${designText}`,
    html: shell(env, {
      heading: 'You were mentioned',
      intro: `<strong>${who}</strong> mentioned you in a comment on <strong>${liveDoc}</strong>:`,
      outro: `“${escapeHtml(mentionQuote(commentText))}”`,
      ctaText: 'Open the design',
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

// docs/specs/014-identity/transactional-email.md (#1): someone other than the owner left a comment on a design the
// recipient owns. Opt-out (notifyComments). Never includes the comment text
// (privacy): just who, which design, and a link to open it.
export function commentNotificationEmail(
  env: Env,
  designName: string,
  designId: string,
  commenterName: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const whoText =
    commenterName && commenterName.trim() ? escapeText(commenterName.trim()) : 'Someone';
  const nameText = designName && designName.trim() ? escapeText(designName.trim()) : 'your design';
  const who = commenterName && commenterName.trim() ? escapeHtml(commenterName.trim()) : 'Someone';
  const name = designName && designName.trim() ? escapeHtml(designName.trim()) : 'your design';
  return {
    kind: 'CommentNotification',
    subject: `${whoText} commented on ${nameText}`,
    html: shell(env, {
      heading: 'New comment on your design',
      intro: `<strong>${who}</strong> left a comment on <strong>${name}</strong>. Open the design to read it and reply.`,
      ctaText: 'Open the design',
      ctaHref: `${base}/design/${encodeURIComponent(designId)}`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone commented on a design you own.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/014-identity/transactional-email.md (#6): a small celebration when an owner reaches a design-count
// milestone. Opt-out (notifyMilestones).
export function milestoneEmail(env: Env, count: number): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'Milestone',
    subject: `You’ve made ${count} designs on livedesign`,
    html: shell(env, {
      heading: `That’s ${count} designs`,
      intro: `Nice work, you’ve created <strong>${count}</strong> designs on livedesign. Thanks for building with us.`,
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
// (notifyMilestones), same category as the design-count milestone.
export function firstShareEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'FirstShare',
    subject: 'You shared your first design',
    html: shell(env, {
      heading: 'Your first shared design',
      preheader: 'Anyone with the link can open it now, and you stay in control.',
      intro:
        'Nice work, you just shared a design for the first time. Anyone with the link can open it, and you stay in control:',
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
