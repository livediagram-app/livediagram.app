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

export type RenderedEmail = { subject: string; html: string };

type Section = {
  heading: string;
  intro: string;
  points?: string[];
  outro?: string;
  ctaText?: string;
  ctaHref?: string;
  footer?: string;
};

function shell(section: Section): string {
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
