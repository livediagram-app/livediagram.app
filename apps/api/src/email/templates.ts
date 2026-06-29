// spec/64: the five email bodies. Plain, inline-styled, email-client-safe HTML
// (no external CSS, tables for layout where it matters). Each builder returns
// { subject, html }; links resolve against APP_BASE_URL via appBaseUrl(env).
// Content only: never a diagram's contents, only the user's own account facts
// plus a team name the inviter already chose.

import type { Env } from '../types';
import { appBaseUrl } from './client';

const BRAND = '#0ea5e9';
const INK = '#0f172a';
const MUTED = '#475569';

// Default sign-off, used by the onboarding emails (their recipients all have an
// account). The invite + account-deleted builders pass their own, since those
// recipients may not have (or no longer have) an account.
const ACCOUNT_FOOTER =
  'You’re receiving this because you have a livediagram account. The editor is free and open source.';

// spec/64: footer for an opt-out notification email — the reason, plus a link to
// the profile page where the recipient can turn the category off in one click.
function manageNotificationsFooter(env: Env, reason: string): string {
  const href = `${appBaseUrl(env)}/explorer/profile`;
  return `${reason} <a href="${href}" style="color:${BRAND};text-decoration:underline">Manage your notifications</a> to turn these off.`;
}

export type RenderedEmail = { subject: string; html: string; unsubscribeUrl?: string };

// Profile page where every opt-out category can be turned off. Used by both the
// footer link and the List-Unsubscribe header (spec/64).
export function profilePath(env: Env): string {
  return `${appBaseUrl(env)}/explorer/profile`;
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

function shell(section: Section): string {
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
<html><body style="margin:0;background:#f8fafc;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
      <tr><td style="padding:28px 32px 0">
        <span style="font-size:18px;font-weight:700;color:${INK}">live<span style="color:${BRAND}">diagram</span></span>
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
  </td></tr></table>
</body></html>`;
}

export function welcomeEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    subject: 'Welcome to livediagram',
    html: shell({
      heading: 'Welcome, let’s draw something',
      intro:
        'livediagram is a fast, no-friction canvas for diagrams. Here’s how to get your first one going:',
      points: [
        '<strong>Drop a shape</strong> from the palette, double-click it to type, and drag the corners to resize.',
        '<strong>Connect things</strong> by hovering an element’s edge and dragging an arrow to another, and the arrow stays pinned as you move them.',
        '<strong>Start from a template</strong> (flowchart, mind map, kanban, SWOT and more) or pick one of the built-in themes for an instant look.',
      ],
      outro: 'Everything autosaves as you go, so you can just start and come back later.',
      ctaText: 'Start drawing',
      ctaHref: `${base}/new`,
    }),
  };
}

export function week1Email(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    subject: 'Find your way around the Explorer',
    html: shell({
      heading: 'Your diagrams, organised',
      intro: 'Now that you’ve made a few diagrams, the Explorer is where you keep them tidy:',
      points: [
        '<strong>Folders</strong> group related diagrams; drag to sort, and collapse folders you’re not using.',
        '<strong>Search and Recents</strong> jump you straight back to what you were working on.',
        '<strong>Share or export</strong> right from the grid: a view-only or editor link, or a PDF / PNG / SVG / Markdown copy.',
      ],
      ctaText: 'Open your Explorer',
      ctaHref: `${base}/explorer`,
    }),
  };
}

export function week2Email(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    subject: 'Bring your team onto the canvas',
    html: shell({
      heading: 'Diagrams are better together',
      intro:
        'If you’re working with other people, a team gives everyone a shared home for diagrams:',
      points: [
        '<strong>Create a team</strong> from the Explorer and invite people by email.',
        '<strong>A shared folder</strong> every member can open and edit (no more passing links around).',
        '<strong>Admin and Member roles</strong>: admins manage who’s in the team, everyone else just gets to work.',
      ],
      outro: 'The canvas itself still needs no account. Teams just add a shared home on top.',
      ctaText: 'Create a team',
      ctaHref: `${base}/explorer/team`,
    }),
  };
}

export function teamInviteEmail(env: Env, teamName: string | null): RenderedEmail {
  const base = appBaseUrl(env);
  const named = !!(teamName && teamName.trim());
  const name = named ? escapeHtml(teamName!.trim()) : 'a team';
  return {
    subject: `You’ve been invited to ${named ? escapeText(teamName!.trim()) : 'a team'} on livediagram`,
    html: shell({
      heading: `You’re invited to ${name}`,
      intro: `Someone invited you to join <strong>${name}</strong> on livediagram, a shared space for diagrams you and your teammates can open and edit together.`,
      outro:
        'Sign in (or sign up, it’s free) with this email address and the invite will be waiting on your invites page.',
      ctaText: 'View your invite',
      ctaHref: `${base}/explorer/invites`,
      footer:
        'You’re receiving this because someone invited you to a team on livediagram. If it wasn’t expected, you can safely ignore it, nothing happens unless you accept.',
    }),
  };
}

export function accountDeletedEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    subject: 'Your livediagram account has been deleted',
    html: shell({
      heading: 'Your account has been deleted',
      intro:
        'This confirms that your livediagram account and the diagrams stored under it have been permanently removed, as you requested. There’s nothing left for you to do.',
      outro:
        'If this wasn’t you, or you change your mind, you’re always welcome back. The canvas is free and needs no account to start.',
      ctaText: 'Start a new diagram',
      ctaHref: `${base}/new`,
      footer:
        'This is a one-time confirmation of your account deletion. We won’t send any further email to this address.',
    }),
  };
}

// spec/65: a new person opened one of the owner's shared diagrams for the
// first time. Sent to the diagram OWNER, so the diagram name is their own
// content coming back to them (not a spec/64 §7 leak). `joinerName` is the
// visitor's display name when known (already visible to the owner in live
// presence / the Shared list); null falls back to "Someone".
export function diagramJoinedEmail(
  env: Env,
  diagramName: string,
  joinerName: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const who = joinerName && joinerName.trim() ? escapeHtml(joinerName.trim()) : 'Someone';
  const named = diagramName && diagramName.trim() ? escapeHtml(diagramName.trim()) : 'your diagram';
  const whoText = joinerName && joinerName.trim() ? escapeText(joinerName.trim()) : 'Someone';
  return {
    subject: `${whoText} opened one of your diagrams`,
    html: shell({
      heading: 'Someone joined your diagram',
      intro: `<strong>${who}</strong> just opened <strong>${named}</strong>, a diagram you shared. They can collaborate on it with the access you granted.`,
      outro:
        'You’re getting this because you turned on join notifications. You can turn them off any time from your profile.',
      ctaText: 'Open the diagram',
      ctaHref: `${base}/explorer`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone opened a diagram you shared.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// spec/65: an invitee accepted or declined a team invite. Sent to the team's
// admins. The responder address + team name are both already known to the
// inviting admin (they typed the address, they named the team), so this stays
// within spec/64 §7.
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
    subject: `${escapeText(responderEmail)} ${verb} your invitation to ${teamText}`,
    html: shell({
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

// Minimal escaping for the one piece of user-influenced text in an email body
// (the team name). HTML-escape for the body, and a plain-text variant for the
// subject line.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeText(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').slice(0, 80);
}

// spec/64 (#3): a one-time heads-up that an API token (spec/61) is within a week
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
    subject: 'Your livediagram API token expires soon',
    html: shell({
      heading: 'An API token is about to expire',
      intro: `Your API token <strong>${name}</strong> expires on ${when}. Once it lapses, any script or connected tool using it will stop being able to reach your diagrams.`,
      points: [
        'Create a fresh token from Explorer, Tokens before this one expires.',
        'Update whatever uses it (your scripts, or a connected AI tool) with the new token.',
        'Revoke the old token once the switch is done.',
      ],
      outro: 'Tokens last six months; this is the only reminder we send for each one.',
      ctaText: 'Manage your tokens',
      ctaHref: `${base}/explorer/tokens`,
      footer:
        'You’re receiving this because an API token on your livediagram account is nearing its expiry.',
    }),
  };
}

// spec/64 (#4): a gentle nudge for someone who signed up but hasn't created a
// diagram yet (fires once, ~3 days in). Onboarding, not opt-out.
export function activationEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    subject: 'Your canvas is waiting',
    html: shell({
      heading: 'Ready when you are',
      intro:
        'You signed up for livediagram but haven’t made a diagram yet. It takes about thirty seconds to get going:',
      points: [
        'Open a blank canvas and drop a shape, or start from a template (flowchart, mind map, kanban and more).',
        'Double-click to type, drag from an edge to connect, and it all autosaves as you go.',
        'Pick a theme for an instant look you can change any time.',
      ],
      outro: 'No pressure: the canvas is free and always here.',
      ctaText: 'Make your first diagram',
      ctaHref: `${base}/new`,
    }),
  };
}

// spec/64 (#1): someone other than the owner left a comment on a diagram the
// recipient owns. Opt-out (notifyComments). Never includes the comment text
// (privacy): just who, which diagram, and a link to open it.
export function commentNotificationEmail(
  env: Env,
  diagramName: string,
  diagramId: string,
  commenterName: string | null,
): RenderedEmail {
  const base = appBaseUrl(env);
  const whoText =
    commenterName && commenterName.trim() ? escapeText(commenterName.trim()) : 'Someone';
  const nameText =
    diagramName && diagramName.trim() ? escapeText(diagramName.trim()) : 'your diagram';
  const who = commenterName && commenterName.trim() ? escapeHtml(commenterName.trim()) : 'Someone';
  const name = diagramName && diagramName.trim() ? escapeHtml(diagramName.trim()) : 'your diagram';
  return {
    subject: `${whoText} commented on ${nameText}`,
    html: shell({
      heading: 'New comment on your diagram',
      intro: `<strong>${who}</strong> left a comment on <strong>${name}</strong>. Open the diagram to read it and reply.`,
      ctaText: 'Open the diagram',
      ctaHref: `${base}/diagram/${encodeURIComponent(diagramId)}`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because someone commented on a diagram you own.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// spec/64 (#5): a friendly re-engagement nudge for someone who's been away for
// a few weeks. Opt-out (notifyTips).
export function winBackEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    subject: 'Your diagrams are waiting',
    html: shell({
      heading: 'It’s been a while',
      intro:
        'You haven’t opened livediagram in a few weeks, and your diagrams are right where you left them. A few things you can pick back up:',
      points: [
        'Start something new in seconds from a template or theme.',
        'Share a diagram with a live link, or bring a team onto the canvas.',
        'Export to PDF / PNG / SVG / Markdown whenever you need a copy.',
      ],
      outro: 'No rush: it’s all still here whenever you want it.',
      ctaText: 'Open your diagrams',
      ctaHref: `${base}/explorer`,
      footer: manageNotificationsFooter(
        env,
        'You’re receiving this because you have a livediagram account and check-ins are on.',
      ),
    }),
    unsubscribeUrl: profilePath(env),
  };
}

// spec/64 (#6): a small celebration when an owner reaches a diagram-count
// milestone. Opt-out (notifyMilestones).
export function milestoneEmail(env: Env, count: number): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    subject: `You’ve made ${count} diagrams on livediagram`,
    html: shell({
      heading: `That’s ${count} diagrams`,
      intro: `Nice work, you’ve created <strong>${count}</strong> diagrams on livediagram. Thanks for building with us.`,
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

// spec/64 (#6): the first time an owner creates a share link. Opt-out
// (notifyMilestones), same category as the diagram-count milestone.
export function firstShareEmail(env: Env): RenderedEmail {
  const base = appBaseUrl(env);
  return {
    subject: 'You shared your first diagram',
    html: shell({
      heading: 'Your first shared diagram',
      preheader: 'Anyone with the link can open it now, and you stay in control.',
      intro:
        'Nice work, you just shared a diagram for the first time. Anyone with the link can open it, and you stay in control:',
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
