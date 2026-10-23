// docs/specs/014-identity/transactional-email.md: the email bodies. Plain, inline-styled, email-client-safe HTML
// (no external CSS, tables for layout where it matters). Each builder returns
// { subject, html }; links resolve against APP_BASE_URL via appBaseUrl(env).
// Content only: never a document's contents, only the user's own account facts
// plus a team name the inviter already chose.

import { xmlEscape } from '@livedocuments/icons';
import type { Env } from '../types';
import { appBaseUrl } from './client';

// brand-700: it carries the button's white text and the links' text, and white on
// amber-500 is 2.2:1 where brand-700 clears AA at 5.9:1.
const BRAND = '#a34a0c';
// The wordmark's "live" accent: brand-700, as in the site header's light mode.
const WORDMARK_ACCENT = '#a34a0c';
const INK = '#0f172a';
const MUTED = '#475569';
// The brand prism's light-to-deep amber run, for the band across the top of the
// card. Outlook ignores the gradient and paints BRAND underneath instead.
const BAND_GRADIENT = 'linear-gradient(90deg,#fbbf24 0%,#f59e0b 45%,#c2410c 100%)';
// The page behind the card: brand-50, so the frame reads livedocuments before a
// word is read.
const CANVAS = '#fffbeb';

// The logo mark beside the wordmark. A transparent PNG on the public site, not
// inline SVG: Gmail and Outlook drop SVG, and most clients block data: images.
// `pnpm icons:brand` writes it into the marketing app's public/email/, a path kept
// for email alone because every message ever sent points at it. 64px, 2x the slot.
const LOGO_PATH = '/email/livedocuments-mark-64.png';
const LOGO_SIZE = 28;

// Default sign-off, used by the milestone emails (their recipients all have an
// account). The invite + account-deleted builders pass their own, since those
// recipients may not have (or no longer have) an account.
const ACCOUNT_FOOTER =
  'You’re receiving this because you have a livedocuments account. The editor is free and open source.';

// docs/specs/014-identity/transactional-email.md: footer for an opt-out notification email, the reason plus a link to
// the settings where the recipient can turn the category off in one click.
function manageNotificationsFooter(env: Env, reason: string): string {
  const href = profilePath(env);
  return `${reason} <a href="${href}" style="color:${BRAND};text-decoration:underline">Manage your notifications</a> to turn these off.`;
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
  | 'AccountDeleted';

export type RenderedEmail = {
  kind: EmailKind;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
};

// Where every opt-out category can be turned off: the Settings dialog's
// Notifications category, deep-linked (docs/specs/007-editor/user-preferences.md). Used by both the footer link
// and the List-Unsubscribe header (docs/specs/014-identity/transactional-email.md). Module-private: only the
// templates in this file build URLs with it.
//
// The old `/explorer/profile` URL still redirects here, which matters because
// every email already sent carries it and an unsubscribe link cannot rot.
function profilePath(env: Env): string {
  return `${appBaseUrl(env)}/explorer?settings=notifications`;
}

type Section = {
  heading: string;
  intro: string;
  // The dim inbox preview line shown next to the subject. Kept distinct from the
  // heading so the two-line inbox listing reads well; falls back to the intro.
  preheader?: string;
  points?: string[];
  outro?: string;
  ctaText?: string;
  ctaHref?: string;
  footer?: string;
};

// The mark + "live"/"documents" wordmark, linked home. A table rather than flex so
// the two sit on one baseline in Outlook too. The image's alt is empty because
// the wordmark beside it already says the name when images are blocked.
function lockup(base: string, fontSize: number, centred = false): string {
  const mark = Math.round((LOGO_SIZE * fontSize) / 18);
  const margin = centred ? 'margin:0 auto' : 'margin:0';
  return `<a href="${base}" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0" style="${margin}"><tr>
          <td style="padding-right:10px;vertical-align:middle"><img src="${base}${LOGO_PATH}" width="${mark}" height="${mark}" alt="" style="display:block;border:0;outline:none;width:${mark}px;height:${mark}px"></td>
          <td style="vertical-align:middle;font-size:${fontSize}px;font-weight:600;letter-spacing:-0.3px;color:${INK}"><span style="color:${WORDMARK_ACCENT}">live</span>documents</td>
        </tr></table></a>`;
}

function shell(env: Env, section: Section): string {
  const base = appBaseUrl(env);
  const preheader = `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;overflow:hidden">${section.preheader ?? section.intro}</span>`;
  const points = (section.points ?? [])
    .map(
      (p) => `<li style="margin:0 0 10px;color:${MUTED};font-size:15px;line-height:1.6">${p}</li>`,
    )
    .join('');
  const list = points ? `<ul style="margin:18px 0 0;padding-left:20px">${points}</ul>` : '';
  const outro = section.outro
    ? `<p style="margin:20px 0 0;color:${MUTED};font-size:15px;line-height:1.6">${section.outro}</p>`
    : '';
  const cta =
    section.ctaText && section.ctaHref
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0">
           <tr><td style="border-radius:8px;background:${BRAND}">
             <a href="${section.ctaHref}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">${section.ctaText}</a>
           </td></tr>
         </table>`
      : '';
  return `<!doctype html>
<html><body style="margin:0;background:${CANVAS};padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
      <tr><td style="height:6px;line-height:6px;font-size:0;background-color:${BRAND};background-image:${BAND_GRADIENT}">&nbsp;</td></tr>
      <tr><td style="padding:24px 32px 0">
        ${lockup(base, 18)}
      </td></tr>
      <tr><td style="padding:20px 32px 32px">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK}">${section.heading}</h1>
        <p style="margin:0;color:${MUTED};font-size:15px;line-height:1.6">${section.intro}</p>
        ${list}
        ${outro}
        ${cta}
      </td></tr>
      <tr><td style="padding:0 32px 28px">
        <p style="margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;color:#94a3b8;font-size:12px;line-height:1.6">
          ${section.footer ?? ACCOUNT_FOOTER}
        </p>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td align="center" style="padding:20px 32px 0">
        ${lockup(base, 14, true)}
        <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">Write, present and design on pages together, live. Free and open source. <a href="${base}" style="color:${WORDMARK_ACCENT};text-decoration:none">${base.replace(/^https?:\/\//, '')}</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function accountDeletedEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'AccountDeleted',
    subject: 'Your livedocuments account has been deleted',
    html: shell(env, {
      heading: 'Your account has been deleted',
      intro:
        'This confirms that your livedocuments documents and your liveworkspace account have been permanently removed, as you requested. The account is closed for every liveworkspace app. There’s nothing left for you to do.',
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
        : { ctaText: 'Open livedocuments', ctaHref: `${base}/explorer` }),
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
export const MENTION_QUOTE_CHARS = 280;

export function mentionQuote(text: string): string {
  const flat = text.trim().replace(/\s+/g, ' ');
  if (flat.length <= MENTION_QUOTE_CHARS) return flat;
  const cut = flat.slice(0, MENTION_QUOTE_CHARS);
  const space = cut.lastIndexOf(' ');
  return `${(space > MENTION_QUOTE_CHARS / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

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

function escapeText(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').slice(0, 80);
}

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
    subject: `You’ve made ${count} documents on livedocuments`,
    html: shell(env, {
      heading: `That’s ${count} documents`,
      intro: `Nice work, you’ve created <strong>${count}</strong> documents on livedocuments. Thanks for building with us.`,
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
