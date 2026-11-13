// docs/specs/014-identity/transactional-email.md: the bodies of the emails liveplanner sends itself, the
// notifications about other people's activity and the account-deleted notice. The onboarding series and the team
// emails are the liveworkspace accounts Worker's (liveworkspace/docs/specs/003-accounts/accounts.md). Plain, inline-styled,
// email-client-safe HTML (no external CSS, tables for layout where it matters). Each builder returns
// { subject, html }; links resolve against APP_BASE_URL via appBaseUrl(env).
// Content only: never a project's contents, only names the recipient already knows.

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

// The shared look (@liveworkspace/email/layout), in liveplanner's brand.
const layout = createEmailLayout({
  brand: '#8b5cf6',
  wordmarkAccent: '#7c3aed',
  bandGradient: 'linear-gradient(90deg,#a78bfa 0%,#8b5cf6 45%,#7e22ce 100%)',
  canvas: '#f5f3ff',
  // `pnpm icons:brand` writes it into the marketing app's public/email/. 64px, 2x the slot.
  logoPath: '/email/liveplanner-mark-64.png',
  wordmarkTail: 'planner',
  tagline: 'Plan the work together, live. Free, with no trackers.',
  accountFooter:
    'You’re receiving this because you have a liveplanner account. liveplanner is free, with no ads and no trackers.',
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
  | 'ProjectJoined'
  | 'CommentNotification'
  | 'ActionAssigned'
  | 'Mentioned'
  | 'FormResponse'
  | 'FormSuspended'
  | 'AutomationEmail'
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
    subject: 'Your liveplanner account has been deleted',
    html: shell(env, {
      heading: 'Your account has been deleted',
      intro:
        'This confirms that your liveplanner plans and your liveworkspace account have been permanently removed, as you requested. The account is closed for every liveworkspace app. There’s nothing left for you to do.',
      outro:
        'If this wasn’t you, or you change your mind, you’re always welcome back. liveplanner is free and needs no account to start.',
      ctaText: 'Start a new plan',
      ctaHref: `${base}/new`,
      footer:
        'This is a one-time confirmation of your account deletion. We won’t send any further email to this address.',
    }),
  };
}

// Escaping for the one piece of user-influenced text in an email body (the
// team name): the repo's one markup escaper for the body, and a plain-text
// variant for the subject line. A local copy used to skip the apostrophe.
const escapeHtml = xmlEscape;

const escapeText = subjectText;

// docs/specs/014-identity/transactional-email.md (#1): someone other than the owner left a comment on a project the
// recipient owns. Opt-out (notifyComments). Never includes the comment text
// (privacy): just who, which project, and a link to open it.
export function commentNotificationEmail(
  env: Env,
  projectName: string,
  projectId: string,
  commenterName: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const whoText =
    commenterName && commenterName.trim() ? escapeText(commenterName.trim()) : 'Someone';
  const nameText = projectName && projectName.trim() ? escapeText(projectName.trim()) : 'your plan';
  const who = commenterName && commenterName.trim() ? escapeHtml(commenterName.trim()) : 'Someone';
  const name = projectName && projectName.trim() ? escapeHtml(projectName.trim()) : 'your plan';
  return {
    kind: 'CommentNotification',
    subject: `${whoText} commented on ${nameText}`,
    html: shell(env, {
      heading: 'New comment on your plan',
      intro: `<strong>${who}</strong> left a comment on <strong>${name}</strong>. Open the plan to read it and reply.`,
      ctaText: 'Open the plan',
      ctaHref: `${base}/project/${encodeURIComponent(projectId)}`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone commented on a plan you own.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// A form's new response (docs/specs/030-forms/forms.md "Hearing about responses"): the card's title and a button
// to its board. `more`: responses that arrived while the last email held the throttle. Opt-out (notifyFormResponses).
export function formResponseEmail(
  env: Env,
  form: { heading: string; projectId: string; projectName: string },
  cardTitle: string,
  more: number,
): RenderedEmail {
  const base = appBaseUrl(env);
  const headingText = escapeText(form.heading.trim() || 'your form');
  const heading = escapeHtml(form.heading.trim() || 'your form');
  const title = escapeHtml(cardTitle.trim() || 'A new response');
  const docName = escapeHtml(form.projectName.trim() || 'your plan');
  const since =
    more > 0
      ? ` And ${more} more ${more === 1 ? 'response has' : 'responses have'} arrived since the last email.`
      : '';
  return {
    kind: 'FormResponse',
    subject: `New response to ${headingText}`,
    html: shell(env, {
      heading: `New response to ${heading}`,
      intro: `<strong>${title}</strong> just arrived on your board in <strong>${docName}</strong>.${since}`,
      ctaText: 'Open the board',
      ctaHref: `${base}/project/${encodeURIComponent(form.projectId)}`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone filled in a form in a plan you own.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// A rule's Send Email (docs/specs/026-plan/automations.md "Actions"): the subject and body its Editor wrote (values
// filled in), the rule's name and the plan's, and a button that opens the card. Everything in it is escaped; the
// body's lines stay lines. Opt-out with assigned actions (notifyActionAssigned): it tells someone about a card.
export function automationEmail(
  env: Env,
  input: { subject: string; body: string; rule: string; planName: string; cardUrl: string },
): RenderedEmail {
  const body = input.body
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join('<br>');
  return {
    kind: 'AutomationEmail',
    subject: escapeText(input.subject.trim() || input.rule),
    html: shell(env, {
      heading: escapeHtml(input.subject.trim() || input.rule),
      intro: body || escapeHtml(input.rule),
      outro: `Sent by the rule <strong>${escapeHtml(input.rule)}</strong> in <strong>${escapeHtml(input.planName.trim() || 'a plan')}</strong>.`,
      ctaText: 'Open the card',
      ctaHref: input.cardUrl,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a rule in a plan you work on sends it.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// A rule's Send Email to typed-in addresses (docs/specs/026-plan/automations.md "Typed-in addresses"): the subject and
// body as automationEmail's, then fixed words the rule cannot change (which rule, which plan, why this address), and
// a link that stops this plan's rules emailing the address. `unsubscribeUrl` is the one-click POST door (sent as
// List-Unsubscribe with List-Unsubscribe-Post), `unsubscribePage` the page the footer's link opens.
export function automationAddressEmail(
  env: Env,
  input: {
    subject: string;
    body: string;
    rule: string;
    planName: string;
    cardUrl: string;
    unsubscribeUrl: string;
    unsubscribePage: string;
  },
): RenderedEmail & { oneClick: true } {
  const body = input.body
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join('<br>');
  const plan = escapeHtml(input.planName.trim() || 'a plan');
  return {
    kind: 'AutomationEmail',
    subject: escapeText(input.subject.trim() || input.rule),
    html: shell(env, {
      heading: escapeHtml(input.subject.trim() || input.rule),
      intro: body || escapeHtml(input.rule),
      outro: `Sent by the rule <strong>${escapeHtml(input.rule)}</strong> in the plan <strong>${plan}</strong> on liveplanner. You got this because an Editor of the plan added your address to the rule.`,
      ctaText: 'Open the card',
      ctaHref: input.cardUrl,
      footer: `Don’t want these? <a href="${escapeHtml(input.unsubscribePage)}" style="color:#8b5cf6;text-decoration:underline">Stop emails from this plan’s rules</a>.`,
    }),
    unsubscribeUrl: input.unsubscribeUrl,
    oneClick: true,
  };
}

// A form's link suspended after reports (docs/specs/030-forms/forms.md "Report This Form"). Not opt-out: it is about
// something the owner published, and the link has stopped working.
export function formSuspendedEmail(
  env: Env,
  form: { heading: string; projectId: string; projectName: string },
): RenderedEmail {
  const base = appBaseUrl(env);
  const headingText = escapeText(form.heading.trim() || 'your form');
  const heading = escapeHtml(form.heading.trim() || 'your form');
  const docName = escapeHtml(form.projectName.trim() || 'your plan');
  return {
    kind: 'FormSuspended',
    subject: `The link to ${headingText} was suspended`,
    html: shell(env, {
      heading: 'Your form’s link was suspended',
      intro: `People who were sent the link to <strong>${heading}</strong> in <strong>${docName}</strong> reported it, so the link has stopped working. Its responses stay on your board. You can publish the form again, which makes a new link.`,
      ctaText: 'Open the plan',
      ctaHref: `${base}/project/${encodeURIComponent(form.projectId)}`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a form you published was reported by the people it was sent to.',
      ),
    }),
  };
}

// docs/specs/014-identity/profile-and-email-notifications.md: a new person opened one of the owner's shared projects for the
// first time. Sent to the project OWNER, so the project name is their own
// content coming back to them (not a docs/specs/014-identity/transactional-email.md §7 leak). `joinerName` is the
// visitor's display name when known (already visible to the owner in live
// presence / the Shared list); null falls back to "Someone".
export function projectJoinedEmail(
  env: Env,
  projectName: string,
  joinerName: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const who = joinerName && joinerName.trim() ? escapeHtml(joinerName.trim()) : 'Someone';
  const named = projectName && projectName.trim() ? escapeHtml(projectName.trim()) : 'your plan';
  const whoText = joinerName && joinerName.trim() ? escapeText(joinerName.trim()) : 'Someone';
  return {
    kind: 'ProjectJoined',
    subject: `${whoText} opened one of your plans`,
    html: shell(env, {
      heading: 'Someone joined your plan',
      intro: `<strong>${who}</strong> just opened <strong>${named}</strong>, a plan you shared. They can collaborate on it with the access you granted.`,
      outro:
        'Join notifications are on by default for plans you share. You can turn them off any time in your notification settings.',
      ctaText: 'Open the plan',
      ctaHref: `${base}/explorer`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone opened a plan you shared.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/012-collaboration/assigned-actions.md: someone assigned the recipient an action on a project element.
// Sent to the assignee (a joined teammate of the assigner). Opt-out
// (notifyActionAssigned). Everything user-influenced here (assigner name,
// project name, action name, description) is either the assigner's own words
// being delivered on their behalf or a project/team fact the two already
// share (docs/specs/014-identity/transactional-email.md §7), and all of it is escaped.
const ACTION_DESCRIPTION_PREVIEW_CHARS = 200;

export function actionAssignedEmail(
  env: Env,
  assignerName: string | null,
  // Null when the assignee cannot open the project (docs/specs/012-collaboration/assigned-actions.md §4): the
  // email names no project and its button opens the Explorer instead of a page they would be refused.
  project: { id: string; name: string } | null,
  actionName: string,
  description: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const who = assignerName && assignerName.trim() ? escapeHtml(assignerName.trim()) : 'A teammate';
  const whoText =
    assignerName && assignerName.trim() ? escapeText(assignerName.trim()) : 'A teammate';
  const liveDoc =
    project && project.name.trim() ? escapeHtml(project.name.trim()) : 'a shared plan';
  const action = escapeHtml(actionName.trim());
  const detail = description?.trim()
    ? escapeHtml(
        description.trim().length > ACTION_DESCRIPTION_PREVIEW_CHARS
          ? `${description.trim().slice(0, ACTION_DESCRIPTION_PREVIEW_CHARS)}…`
          : description.trim(),
      )
    : null;
  const intro = project
    ? `<strong>${who}</strong> assigned you an action on <strong>${liveDoc}</strong>: <strong>${action}</strong>.`
    : `<strong>${who}</strong> assigned you an action: <strong>${action}</strong>. You can’t open its plan yet, so ask them to share it with you.`;
  return {
    kind: 'ActionAssigned',
    subject: `${whoText} assigned you an action`,
    html: shell(env, {
      heading: 'You have a new action',
      intro,
      ...(detail ? { outro: detail } : {}),
      ...(project
        ? {
            ctaText: 'Open the plan',
            ctaHref: `${base}/project/${encodeURIComponent(project.id)}`,
          }
        : { ctaText: 'Open liveplanner', ctaHref: `${base}/explorer` }),
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a teammate assigned you an action.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/012-collaboration/comment-mentions.md: a teammate @-mentioned the recipient in a comment. The
// author and project name come from server state (the plan the comment is on);
// the quote is the author's own words, escaped and cut at a word.
// A card's part as a mention names it: `<card>`, or `<card>/<thread>` for one of its threads (the editor's deep
// link opens that thread, lib/collab-deep-link.ts). Card and thread ids never hold a slash.
function cardHash(part: string): string {
  const [card = '', thread] = part.split('/');
  const hash = `item=${encodeURIComponent(card)}`;
  // In an HTML attribute, so the ampersand is written as an entity.
  return thread ? `${hash}&amp;thread=${encodeURIComponent(thread)}` : hash;
}

export function mentionedEmail(
  env: Env,
  authorName: string | null,
  projectName: string,
  projectId: string,
  commentText: string,
  // A Plan card's comment: the button opens the card (docs/specs/012-collaboration/comment-mentions.md).
  itemId?: string,
): RenderedEmail {
  const base = appBaseUrl(env);
  const docHref = `${base}/project/${encodeURIComponent(projectId)}`;
  const who = authorName && authorName.trim() ? escapeHtml(authorName.trim()) : 'A teammate';
  const whoText = authorName && authorName.trim() ? escapeText(authorName.trim()) : 'A teammate';
  const liveDoc =
    projectName && projectName.trim() ? escapeHtml(projectName.trim()) : 'a shared plan';
  const projectText = projectName && projectName.trim() ? escapeText(projectName.trim()) : 'a plan';
  return {
    kind: 'Mentioned',
    subject: `${whoText} mentioned you in ${projectText}`,
    html: shell(env, {
      heading: 'You were mentioned',
      intro: `<strong>${who}</strong> mentioned you in a comment on <strong>${liveDoc}</strong>:`,
      outro: `“${escapeHtml(mentionQuote(commentText))}”`,
      ctaText: itemId ? 'Open the card' : 'Open the plan',
      ctaHref: itemId ? `${docHref}#${cardHash(itemId)}` : docHref,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a teammate mentioned you in a comment.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/014-identity/transactional-email.md (#6): a small celebration when an owner reaches a project-count
// milestone. Opt-out (notifyMilestones).
export function milestoneEmail(env: Env, count: number): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'Milestone',
    subject: `You’ve made ${count} plans on liveplanner`,
    html: shell(env, {
      heading: `That’s ${count} plans`,
      intro: `Nice work, you’ve created <strong>${count}</strong> plans on liveplanner. Thanks for building with us.`,
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
// (notifyMilestones), same category as the project-count milestone.
export function firstShareEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'FirstShare',
    subject: 'You shared your first plan',
    html: shell(env, {
      heading: 'Your first shared plan',
      preheader: 'Anyone with the link can open it now, and you stay in control.',
      intro:
        'Nice work, you just shared a plan for the first time. Anyone with the link can open it, and you stay in control:',
      points: [
        'Hand out a <strong>view-only</strong> or an <strong>editor</strong> link, whichever fits.',
        'Set a link to <strong>expire</strong> after a week, a month, or six months.',
        'Revoke a link any time from the Share dialog, and it stops working instantly.',
      ],
      outro: 'Collaboration needs no account, so whoever you share with can jump straight in.',
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
