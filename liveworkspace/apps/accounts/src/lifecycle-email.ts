// The onboarding series' emails (liveworkspace/docs/accounts.md "Onboarding emails"): a welcome, the
// Explorer at a week, teams at two weeks, a nudge for someone who hasn't made anything, and a win-back
// for someone who has been away. One series per account, from liveworkspace, whichever apps the person
// uses. The same timings and the same tips as each app's series had, worded for all four apps. Plain,
// inline-styled HTML that email clients keep; nothing a person wrote is ever in one.
import { APP_SITES, type SiteId } from '@liveworkspace/sites';
import { settingsUrl } from './email.ts';
import { appUrl, emailBrand, frame, INK, MUTED, paragraph } from './email-layout.ts';
import type { Env } from './env.ts';
import type { SettingsApp } from './settings.ts';

export type LifecycleStage = 'welcome' | 'week1' | 'week2' | 'activation' | 'winback';

export interface LifecycleEmail {
  subject: string;
  text: string;
  html: string;
  // For the tips that can be turned off: where, sent as List-Unsubscribe as well as the footer link.
  unsubscribeUrl?: string;
}

const SLATE = '#334155';

const origin = (url: string) => url.replace(/\/+$/, '');

export { appUrl };

// Who the email is for: the app it speaks for (the one they signed up through, else the first they
// used), where its links go. Null speaks for liveworkspace itself: someone who signed up on
// liveworkspace.app and hasn't opened an app yet is sent to the apps, to pick one. Tips are turned
// off on liveworkspace.app, whichever app.
export interface Recipient {
  home: SettingsApp | null;
}

const appName = (app: SiteId) => APP_SITES.find((site) => site.id === app)?.name ?? app;

// The calls to action that go to an app: starting something, the Explorer, and their work in it.
function homeOf(env: Pick<Env, 'ENVIRONMENT' | 'BASE_URL'>, recipient: Recipient) {
  if (!recipient.home) {
    const apps = { text: 'Pick an app', href: `${origin(env.BASE_URL)}/#apps` };
    return { start: apps, explorer: apps, work: apps };
  }
  const url = appUrl(env, recipient.home);
  return {
    start: { text: `Start in ${appName(recipient.home)}`, href: `${url}/new` },
    explorer: { text: 'Open your Explorer', href: `${url}/explorer` },
    work: { text: 'Open your work', href: `${url}/explorer` },
  };
}

// The four apps, each a line with a link: what one account opens.
function appLines(env: Pick<Env, 'ENVIRONMENT'>): { html: string[]; text: string[] } {
  const html = APP_SITES.map(
    (site) =>
      `<strong><a href="${appUrl(env, site.id)}" style="color:${SLATE}">${site.name}</a></strong>: ${site.pitch.toLowerCase()}.`,
  );
  const text = APP_SITES.map(
    (site) => `${site.name} (${appUrl(env, site.id)}): ${site.pitch.toLowerCase()}.`,
  );
  return { html, text };
}

type Section = {
  subject: string;
  heading: string;
  intro: string;
  points?: { html: string[]; text: string[] };
  outro?: string;
  cta: { text: string; href: string };
  // The tips that can be turned off carry where to do it.
  unsubscribeUrl?: string;
};

const ACCOUNT_FOOTER =
  'You’re receiving this because you have a liveworkspace account. liveworkspace is free, with no ads and no trackers.';
const TIPS_FOOTER =
  'You’re receiving this because you have a liveworkspace account and tips and check-ins are on.';

// Tags out, for the plain-text part: the points carry a little markup for the HTML part.
const plain = (html: string) => html.replace(/<[^>]*>/g, '');

// In liveworkspace's frame (email-layout.ts), whichever app it speaks for: the series is liveworkspace's.
function render(env: Pick<Env, 'ENVIRONMENT' | 'BASE_URL'>, section: Section): LifecycleEmail {
  const points = section.points?.html ?? [];
  const list = points.length
    ? `<ul style="margin:18px 0 0;padding-left:20px">${points
        .map(
          (p) =>
            `<li style="margin:0 0 10px;color:${MUTED};font-size:15px;line-height:1.6">${p}</li>`,
        )
        .join('')}</ul>`
    : '';
  const outro = section.outro ? paragraph(section.outro, 20) : '';
  const footer = section.unsubscribeUrl
    ? `${TIPS_FOOTER} <a href="${section.unsubscribeUrl}" style="color:${SLATE};text-decoration:underline">Manage your notifications</a> to turn these off.`
    : ACCOUNT_FOOTER;
  const html = frame(emailBrand(env, null), {
    preheader: section.intro,
    heading: section.heading,
    body: `${paragraph(section.intro)}
        ${list}
        ${outro}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0">
          <tr><td style="border-radius:8px;background:${INK}">
            <a href="${section.cta.href}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">${section.cta.text}</a>
          </td></tr>
        </table>`,
    footer,
  });
  const text = [
    section.heading,
    '',
    plain(section.intro),
    ...(section.points ? ['', ...section.points.text.map((p) => `- ${plain(p)}`)] : []),
    ...(section.outro ? ['', plain(section.outro)] : []),
    '',
    `${section.cta.text}: ${section.cta.href}`,
    '',
    plain(footer),
    ...(section.unsubscribeUrl ? [section.unsubscribeUrl] : []),
  ].join('\n');
  return {
    subject: section.subject,
    text,
    html,
    ...(section.unsubscribeUrl && { unsubscribeUrl: section.unsubscribeUrl }),
  };
}

const both = (items: string[]) => ({ html: items, text: items });

export function lifecycleEmail(
  env: Pick<Env, 'ENVIRONMENT' | 'BASE_URL'>,
  stage: LifecycleStage,
  recipient: Recipient,
): LifecycleEmail {
  const home = homeOf(env, recipient);
  const site = origin(env.BASE_URL);
  // The account's own settings page on liveworkspace.app, where tips are turned off for every app.
  // Signed out, it signs them in and comes back.
  const unsubscribeUrl = settingsUrl(env.BASE_URL);
  switch (stage) {
    case 'welcome':
      return render(env, {
        subject: 'Welcome to liveworkspace',
        heading: 'Welcome, let’s make something',
        intro:
          'Your liveworkspace account signs you in to four free apps for working together in real time. Everything you make in one shows in all of them:',
        points: appLines(env),
        outro:
          'Each starts from a blank page or a template, and saves as you go, so you can just start and come back later.',
        cta: home.start,
      });
    case 'week1':
      return render(env, {
        subject: 'Find your way around the Explorer',
        heading: 'Everything you make, in one place',
        intro:
          'The Explorer in every app shows what you have made in all of them, so you can keep it tidy from wherever you are:',
        points: both([
          '<strong>Folders</strong> hold work from any app; drag to sort, and collapse the ones you’re not using.',
          '<strong>Search, Recent and Favourites</strong> take you straight back to what you were working on.',
          '<strong>Share</strong> right from the grid with a view-only or editor link.',
        ]),
        cta: home.explorer,
        unsubscribeUrl,
      });
    case 'week2':
      return render(env, {
        subject: 'Bring your team into your work',
        heading: 'Better together',
        intro:
          'If you work with other people, a team gives everyone a shared home, the same team in every app:',
        points: both([
          '<strong>Create a team</strong> in the Explorer and invite people by email.',
          '<strong>Work you file under the team</strong> opens for every member, in every app, with no links to pass around.',
          '<strong>Admin and Member roles</strong>: admins manage who’s in the team, everyone else just gets to work.',
        ]),
        outro: 'None of the apps needs an account to start. Teams just add a shared home on top.',
        cta: { text: 'Create a team', href: `${site}/explorer` },
        unsubscribeUrl,
      });
    case 'activation':
      return render(env, {
        subject: 'Your first piece of work is waiting',
        heading: 'Ready when you are',
        intro:
          'You made a liveworkspace account but haven’t made anything yet. It takes about thirty seconds in any of the apps:',
        points: appLines(env),
        outro:
          'Start blank or from a template, share it with one link, and work on it together in real time. No pressure: it’s all free and always here.',
        cta: home.start,
        unsubscribeUrl,
      });
    case 'winback':
      return render(env, {
        subject: 'Your work is waiting',
        heading: 'It’s been a while',
        intro:
          'You haven’t worked in liveworkspace for a few weeks, and everything is right where you left it. A few things you can pick back up:',
        points: both([
          'Start something new in seconds from a template, in any of the four apps.',
          'Share your work with a live link, or bring a team into it.',
          'Find everything from every app in the Explorer.',
        ]),
        outro: 'No rush: it’s all still here whenever you want it.',
        cta: home.work,
        unsubscribeUrl,
      });
  }
}
