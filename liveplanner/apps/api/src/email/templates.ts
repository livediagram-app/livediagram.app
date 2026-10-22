// docs/specs/014-identity/transactional-email.md: the five email bodies. Plain, inline-styled, email-client-safe HTML
// (no external CSS, tables for layout where it matters). Each builder returns
// { subject, html }; links resolve against APP_BASE_URL via appBaseUrl(env).
// Content only: never a project's contents, only the user's own account facts
// plus a team name the inviter already chose.

import { xmlEscape } from '@liveplanner/icons';
import type { Env } from '../types';
import { appBaseUrl } from './client';

const BRAND = '#8b5cf6';
// The wordmark's "live" accent: brand-600, as in the site header's light mode.
const WORDMARK_ACCENT = '#7c3aed';
const INK = '#0f172a';
const MUTED = '#475569';
// The brand prism's light-to-deep violet run, for the band across the top of the
// card. Outlook ignores the gradient and paints BRAND underneath instead.
const BAND_GRADIENT = 'linear-gradient(90deg,#a78bfa 0%,#8b5cf6 45%,#7e22ce 100%)';
// The page behind the card: brand-50, so the frame reads liveplanner before a
// word is read.
const CANVAS = '#f5f3ff';

// The logo mark beside the wordmark. A transparent PNG on the public site, not
// inline SVG: Gmail and Outlook drop SVG, and most clients block data: images.
// `pnpm icons:brand` writes it into the marketing app's public/email/, a path kept
// for email alone because every message ever sent points at it. 64px, 2x the slot.
const LOGO_PATH = '/email/liveplanner-mark-64.png';
const LOGO_SIZE = 28;

// Default sign-off, used by the onboarding emails (their recipients all have an
// account). The invite + account-deleted builders pass their own, since those
// recipients may not have (or no longer have) an account.
const ACCOUNT_FOOTER =
  'You’re receiving this because you have a liveplanner account. liveplanner is free, with no ads and no trackers.';

// docs/specs/014-identity/transactional-email.md: footer for an opt-out notification email, the reason plus a link to
// the settings where the recipient can turn the category off in one click.
function manageNotificationsFooter(env: Env, reason: string): string {
  const href = profilePath(env);
  return `${reason} <a href="${href}" style="color:${BRAND};text-decoration:underline">Manage your notifications</a> to turn these off.`;
}

// docs/specs/014-identity/transactional-email.md: every tip / check-in after the welcome (week 1, week 2, the
// activation nudge, win-back) respects notifyTips, so each carries the same opt-out footer and the
// List-Unsubscribe header pointing at the toggle that stops it.
function tipsFooter(env: Env): string {
  return manageNotificationsFooter(
    env,
    'You’re receiving this because you have a liveplanner account and tips and check-ins are on.',
  );
}

// `kind` is the template's telemetry token (docs/specs/017-telemetry/telemetry.md 'Email' category): it rides
// along on the builder's return so it reaches `sendEmail` through the same
// spread every caller already writes, rather than being re-stated (and
// forgotten) at each of the fourteen call sites. A fixed literal, never a
// subject line or anything the recipient wrote.
export type EmailKind =
  | 'Welcome'
  | 'Week1'
  | 'Week2'
  | 'Activation'
  | 'WinBack'
  | 'Milestone'
  | 'FirstShare'
  | 'TeamInvite'
  | 'TeamInviteReminder1'
  | 'TeamInviteReminder2'
  | 'TeamInviteReminder3'
  | 'InviteResponse'
  | 'ProjectJoined'
  | 'CommentNotification'
  | 'ActionAssigned'
  | 'Mentioned'
  | 'FormResponse'
  | 'FormSuspended'
  | 'TokenExpiring'
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

// The mark + "live"/"planner" wordmark, linked home. A table rather than flex so
// the two sit on one baseline in Outlook too. The image's alt is empty because
// the wordmark beside it already says the name when images are blocked.
function lockup(base: string, fontSize: number, centred = false): string {
  const mark = Math.round((LOGO_SIZE * fontSize) / 18);
  const margin = centred ? 'margin:0 auto' : 'margin:0';
  return `<a href="${base}" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0" style="${margin}"><tr>
          <td style="padding-right:10px;vertical-align:middle"><img src="${base}${LOGO_PATH}" width="${mark}" height="${mark}" alt="" style="display:block;border:0;outline:none;width:${mark}px;height:${mark}px"></td>
          <td style="vertical-align:middle;font-size:${fontSize}px;font-weight:600;letter-spacing:-0.3px;color:${INK}"><span style="color:${WORDMARK_ACCENT}">live</span>planner</td>
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
        <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">Plan the work together, live. Free, with no trackers. <a href="${base}" style="color:${WORDMARK_ACCENT};text-decoration:none">${base.replace(/^https?:\/\//, '')}</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function welcomeEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'Welcome',
    subject: 'Welcome to liveplanner',
    html: shell(env, {
      heading: 'Welcome, let’s plan something',
      intro:
        'liveplanner is a free, real-time planner for teams. Here’s how to get your first project going:',
      points: [
        '<strong>Start a board</strong> of cards, add columns for each stage, and drag cards along as the work moves.',
        '<strong>Add a sheet, a dashboard or a form</strong> as another tab, so the numbers, the charts and the requests live in the same project.',
        '<strong>Start from a template</strong> (kanban, project planner, bug triage and more) to have the columns and card types ready to fill.',
      ],
      outro: 'Everything saves as you go, so you can just start and come back later.',
      ctaText: 'Start planning',
      ctaHref: `${base}/new`,
    }),
  };
}

export function week1Email(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'Week1',
    subject: 'Find your way around the Explorer',
    html: shell(env, {
      heading: 'Your projects, organised',
      intro: 'Now that you’ve made a few projects, the Explorer is where you keep them tidy:',
      points: [
        '<strong>Folders</strong> group related projects; drag to sort, and collapse folders you’re not using.',
        '<strong>Search and Recents</strong> jump you straight back to what you were working on.',
        '<strong>Share</strong> right from the grid with a view-only or editor link, and open a project to export a PDF / PNG / SVG / Markdown copy.',
      ],
      ctaText: 'Open your Explorer',
      ctaHref: `${base}/explorer`,
      footer: tipsFooter(env),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

export function week2Email(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'Week2',
    subject: 'Bring your team into your projects',
    html: shell(env, {
      heading: 'Plans are better together',
      intro:
        'If you’re working with other people, a team gives everyone a shared home for projects:',
      points: [
        '<strong>Create a team</strong> from the Explorer and invite people by email.',
        '<strong>A shared folder</strong> every member can open and edit (no more passing links around).',
        '<strong>Admin and Member roles</strong>: admins manage who’s in the team, everyone else just gets to work.',
      ],
      outro: 'A project still needs no account. Teams just add a shared home on top.',
      ctaText: 'Create a team',
      ctaHref: `${base}/explorer/team`,
      footer: tipsFooter(env),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/013-workspace/teams.md "Declining from the email": where an invite email's Decline link lands. The
// token rides in the query like /join's; the page only reads until its button is pressed.
function declineInviteHref(env: Env, declineToken: string): string {
  return `${appBaseUrl(env)}/join/decline?token=${encodeURIComponent(declineToken)}`;
}

type TeamInviteCopy = { subject: string; heading: string; intro: string; preheader?: string };

// The invite and its reminders share one body (docs/specs/014-identity/transactional-email.md #4, #13): what the
// team is, how to accept, and a quiet Decline link that needs no account. Only the opening lines differ.
function teamInviteSection(
  env: Env,
  copy: Omit<TeamInviteCopy, 'subject'>,
  declineToken: string | null,
): Section {
  const decline = declineToken
    ? ` Not for you? <a href="${declineInviteHref(env, declineToken)}" style="color:${BRAND};text-decoration:underline">Decline the invite</a>, no account needed.`
    : '';
  return {
    ...copy,
    outro: `Sign in (or sign up, it’s free) with this email address and the invite will be waiting on your invites page.${decline}`,
    ctaText: 'View your invite',
    ctaHref: `${appBaseUrl(env)}/explorer/invites`,
    footer:
      'You’re receiving this because someone invited you to a team on liveplanner. If it wasn’t expected, you can safely ignore it, nothing happens unless you accept.',
  };
}

function teamNames(teamName: string | null): { html: string; text: string } {
  const trimmed = teamName?.trim();
  return trimmed
    ? { html: escapeHtml(trimmed), text: escapeText(trimmed) }
    : { html: 'a team', text: 'a team' };
}

export function teamInviteEmail(
  env: Env,
  teamName: string | null,
  declineToken: string | null = null,
): RenderedEmail {
  const name = teamNames(teamName);
  return {
    kind: 'TeamInvite',
    subject: `You’ve been invited to ${name.text} on liveplanner`,
    html: shell(
      env,
      teamInviteSection(
        env,
        {
          heading: `You’re invited to ${name.html}`,
          intro: `Someone invited you to join <strong>${name.html}</strong> on liveplanner, a shared space for projects you and your teammates can open and edit together.`,
        },
        declineToken,
      ),
    ),
  };
}

// docs/specs/013-workspace/teams.md "Reminders and expiry": the three follow-ups, 1, 7 and 21 days in. The last
// one says the invite closes in a week, which is when it expires.
const REMINDER_COPY: Record<1 | 2 | 3, (team: { html: string; text: string }) => TeamInviteCopy> = {
  1: (team) => ({
    subject: `Reminder: you’re invited to ${team.text} on liveplanner`,
    heading: `Your invite to ${team.html} is waiting`,
    intro: `Yesterday someone invited you to join <strong>${team.html}</strong> on liveplanner, a shared space for projects you and your teammates can open and edit together.`,
  }),
  2: (team) => ({
    subject: `Your invite to ${team.text} is still waiting`,
    heading: `Still thinking about ${team.html}?`,
    intro: `A week ago someone invited you to join <strong>${team.html}</strong> on liveplanner. The invite is still open whenever you are ready.`,
  }),
  3: (team) => ({
    subject: `Last reminder: your invite to ${team.text} closes in a week`,
    heading: `Your invite to ${team.html} closes soon`,
    intro: `Someone invited you to join <strong>${team.html}</strong> on liveplanner three weeks ago. This is the last reminder: the invite closes in a week if nobody answers it.`,
  }),
};

export function teamInviteReminderEmail(
  env: Env,
  teamName: string | null,
  stage: 1 | 2 | 3,
  declineToken: string,
): RenderedEmail {
  const { subject, ...copy } = REMINDER_COPY[stage](teamNames(teamName));
  return {
    kind: `TeamInviteReminder${stage}`,
    subject,
    html: shell(env, teamInviteSection(env, copy, declineToken)),
  };
}

export function accountDeletedEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'AccountDeleted',
    subject: 'Your liveplanner account has been deleted',
    html: shell(env, {
      heading: 'Your account has been deleted',
      intro:
        'This confirms that your liveplanner projects and your liveworkspace account have been permanently removed, as you requested. The account is closed for every liveworkspace app. There’s nothing left for you to do.',
      outro:
        'If this wasn’t you, or you change your mind, you’re always welcome back. liveplanner is free and needs no account to start.',
      ctaText: 'Start a new project',
      ctaHref: `${base}/new`,
      footer:
        'This is a one-time confirmation of your account deletion. We won’t send any further email to this address.',
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
  const named = projectName && projectName.trim() ? escapeHtml(projectName.trim()) : 'your project';
  const whoText = joinerName && joinerName.trim() ? escapeText(joinerName.trim()) : 'Someone';
  return {
    kind: 'ProjectJoined',
    subject: `${whoText} opened one of your projects`,
    html: shell(env, {
      heading: 'Someone joined your project',
      intro: `<strong>${who}</strong> just opened <strong>${named}</strong>, a project you shared. They can collaborate on it with the access you granted.`,
      outro:
        'Join notifications are on by default for projects you share. You can turn them off any time in your notification settings.',
      ctaText: 'Open the project',
      ctaHref: `${base}/explorer`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone opened a project you shared.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// docs/specs/014-identity/profile-and-email-notifications.md: an invitee accepted or declined a team invite. Sent to the team's
// admins. The responder address + team name are both already known to the
// inviting admin (they typed the address, they named the team), so this stays
// within docs/specs/014-identity/transactional-email.md §7.
export function inviteResponseEmail(
  env: Env,
  teamName: string | null,
  responderEmail: string,
  accepted: boolean,
): RenderedEmail {
  const base = appBaseUrl(env);
  const team = teamName && teamName.trim() ? escapeHtml(teamName.trim()) : 'your team';
  const teamText = teamName && teamName.trim() ? escapeText(teamName.trim()) : 'your team';
  const who = escapeHtml(responderEmail);
  const verb = accepted ? 'accepted' : 'declined';
  return {
    kind: 'InviteResponse',
    subject: `${escapeText(responderEmail)} ${verb} your invitation to ${teamText}`,
    html: shell(env, {
      heading: accepted ? 'Invitation accepted' : 'Invitation declined',
      intro: accepted
        ? `<strong>${who}</strong> accepted your invitation and is now a member of <strong>${team}</strong>.`
        : `<strong>${who}</strong> declined your invitation to <strong>${team}</strong>. You can invite them again any time.`,
      ctaText: 'Open the team',
      ctaHref: `${base}/explorer/team`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because you’re an admin of this team.',
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
    project && project.name.trim() ? escapeHtml(project.name.trim()) : 'a shared project';
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
    : `<strong>${who}</strong> assigned you an action: <strong>${action}</strong>. You can’t open its project yet, so ask them to share it with you.`;
  return {
    kind: 'ActionAssigned',
    subject: `${whoText} assigned you an action`,
    html: shell(env, {
      heading: 'You have a new action',
      intro,
      ...(detail ? { outro: detail } : {}),
      ...(project
        ? {
            ctaText: 'Open the project',
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
// author and project name come from server state (the notify-mention route);
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
    projectName && projectName.trim() ? escapeHtml(projectName.trim()) : 'a shared project';
  const projectText =
    projectName && projectName.trim() ? escapeText(projectName.trim()) : 'a project';
  return {
    kind: 'Mentioned',
    subject: `${whoText} mentioned you in ${projectText}`,
    html: shell(env, {
      heading: 'You were mentioned',
      intro: `<strong>${who}</strong> mentioned you in a comment on <strong>${liveDoc}</strong>:`,
      outro: `“${escapeHtml(mentionQuote(commentText))}”`,
      ctaText: itemId ? 'Open the card' : 'Open the project',
      ctaHref: itemId ? `${docHref}#item=${encodeURIComponent(itemId)}` : docHref,
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

// docs/specs/014-identity/transactional-email.md (#3): a one-time heads-up that an API token (docs/specs/015-api/public-api-and-tokens.md) is within a week
// of its 6-month expiry, so a script / connected tool doesn't silently break.
// Transactional (account-important); not opt-out.
const EXPIRY_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export function tokenExpiringEmail(
  env: Env,
  tokenName: string | null,
  expiresAt: number,
): RenderedEmail {
  const base = appBaseUrl(env);
  const name = tokenName && tokenName.trim() ? escapeHtml(tokenName.trim()) : 'an API token';
  const d = new Date(expiresAt);
  const when = `${EXPIRY_MONTHS[d.getUTCMonth()]!} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  return {
    kind: 'TokenExpiring',
    subject: 'Your liveplanner API token expires soon',
    html: shell(env, {
      heading: 'An API token is about to expire',
      intro: `Your API token <strong>${name}</strong> expires on ${when}. Once it lapses, any script or connected tool using it will stop being able to reach your projects.`,
      points: [
        'Create a fresh token in Settings, API Tokens before this one expires.',
        'Update whatever uses it (your scripts, or a connected AI tool) with the new token.',
        'Revoke the old token once the switch is done.',
      ],
      outro: 'Tokens last six months; this is the only reminder we send for each one.',
      ctaText: 'Manage your tokens',
      ctaHref: `${base}/explorer?settings=tokens`,
      footer:
        'You’re receiving this because an API token on your liveplanner account is nearing its expiry.',
    }),
  };
}

// docs/specs/014-identity/transactional-email.md (#4): a gentle nudge for someone who signed up but hasn't created a
// project yet (fires once, ~3 days in). Opt-out (notifyTips).
export function activationEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'Activation',
    subject: 'Your first project is waiting',
    html: shell(env, {
      heading: 'Ready when you are',
      intro:
        'You signed up for liveplanner but haven’t made a project yet. It takes about thirty seconds to get going:',
      points: [
        'Start a blank board and add a few cards, or start from a template (kanban, project planner, bug triage and more).',
        'Add a sheet, a dashboard or a form beside it, and it all saves as you go.',
        'Share it with one link and plan it together in real time.',
      ],
      outro: 'No pressure: liveplanner is free and always here.',
      ctaText: 'Make your first project',
      ctaHref: `${base}/new`,
      footer: tipsFooter(env),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

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
  const nameText =
    projectName && projectName.trim() ? escapeText(projectName.trim()) : 'your project';
  const who = commenterName && commenterName.trim() ? escapeHtml(commenterName.trim()) : 'Someone';
  const name = projectName && projectName.trim() ? escapeHtml(projectName.trim()) : 'your project';
  return {
    kind: 'CommentNotification',
    subject: `${whoText} commented on ${nameText}`,
    html: shell(env, {
      heading: 'New comment on your project',
      intro: `<strong>${who}</strong> left a comment on <strong>${name}</strong>. Open the project to read it and reply.`,
      ctaText: 'Open the project',
      ctaHref: `${base}/project/${encodeURIComponent(projectId)}`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone commented on a project you own.',
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
  const docName = escapeHtml(form.projectName.trim() || 'your project');
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
        'You’re receiving this because someone filled in a form in a project you own.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
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
  const docName = escapeHtml(form.projectName.trim() || 'your project');
  return {
    kind: 'FormSuspended',
    subject: `The link to ${headingText} was suspended`,
    html: shell(env, {
      heading: 'Your form’s link was suspended',
      intro: `People who were sent the link to <strong>${heading}</strong> in <strong>${docName}</strong> reported it, so the link has stopped working. Its responses stay on your board. You can publish the form again, which makes a new link.`,
      ctaText: 'Open the project',
      ctaHref: `${base}/project/${encodeURIComponent(form.projectId)}`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because a form you published was reported by the people it was sent to.',
      ),
    }),
  };
}

// docs/specs/014-identity/transactional-email.md (#5): a friendly re-engagement nudge for someone who's been away for
// a few weeks. Opt-out (notifyTips).
export function winBackEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    kind: 'WinBack',
    subject: 'Your projects are waiting',
    html: shell(env, {
      heading: 'It’s been a while',
      intro:
        'You haven’t opened liveplanner in a few weeks, and your projects are right where you left them. A few things you can pick back up:',
      points: [
        'Start something new in seconds from a template or theme.',
        'Share a project with a live link, or bring a team into it.',
        'Export to PDF / PNG / SVG / Markdown whenever you need a copy.',
      ],
      outro: 'No rush: it’s all still here whenever you want it.',
      ctaText: 'Open your projects',
      ctaHref: `${base}/explorer`,
      footer: tipsFooter(env),
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
    subject: `You’ve made ${count} projects on liveplanner`,
    html: shell(env, {
      heading: `That’s ${count} projects`,
      intro: `Nice work, you’ve created <strong>${count}</strong> projects on liveplanner. Thanks for building with us.`,
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
    subject: 'You shared your first project',
    html: shell(env, {
      heading: 'Your first shared project',
      preheader: 'Anyone with the link can open it now, and you stay in control.',
      intro:
        'Nice work, you just shared a project for the first time. Anyone with the link can open it, and you stay in control:',
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
