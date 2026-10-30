import { sendEmail as send } from '@liveworkspace/email';
import type { AppSiteId } from '@liveworkspace/sites';
import {
  button,
  emailBrand,
  escapeHtml,
  frame,
  INK,
  list,
  paragraph,
  workspaceBrand,
  type EmailBrand,
} from './email-layout.ts';
import type { Env } from './env.ts';
import type { SettingsApp } from './settings.ts';
import { reportServerEvent } from './telemetry.ts';

// Every email goes through Cloudflare Email Service's binding (liveworkspace/docs/specs/003-accounts/email.md), as the apps' do.
// Without the binding a development Worker prints the message to its log instead (the code is in the subject), so
// local sign-in works without it; staging and production refuse, so a missing binding is never silent.

type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Where to turn this kind of email off, sent as List-Unsubscribe so mail clients can offer it.
  unsubscribeUrl?: string;
};

export async function sendEmail(env: Env, email: Email): Promise<void> {
  if (!env.EMAIL) {
    if (env.ENVIRONMENT !== 'development') throw new Error('the EMAIL binding is not set');
    console.log(`[email] To: ${email.to} Subject: ${email.subject}`);
    return;
  }
  await send(env.EMAIL, { from: `liveworkspace <${env.EMAIL_FROM}>`, ...email });
}

// A code alone in a tinted panel, large and spaced, so it reads at a glance and copies cleanly: the sign-in code's and
// the deletion code's.
function codePanel(code: string, brand: EmailBrand): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0">
          <tr><td align="center" style="background:${brand.panel};border:1px solid ${brand.panelEdge};border-radius:12px;padding:20px 12px">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${INK}">${code}</span>
          </td></tr>
        </table>`;
}

const ONE_ACCOUNT =
  'One free liveworkspace account signs you in to livediagram, liveplanner, livedocuments and livedesign.';

// The sign-in code, in the frame of the app it was asked for through (null: liveworkspace's own sign-in page), so
// someone signing in to livediagram gets a livediagram email.
export function codeEmail(code: string, brand: EmailBrand) {
  const name = `live${brand.word}`;
  const subject = `${code} is your ${name} sign-in code`;
  const lead = `Enter this code to sign in to ${name}. It works for 10 minutes.`;
  const ignore =
    'If you didn’t try to sign in, you can ignore this email: nobody can sign in without the code.';
  const text = [`Your ${name} sign-in code is ${code}`, '', lead, '', ignore, '', ONE_ACCOUNT].join(
    '\n',
  );
  const html = frame(brand, {
    preheader: `${code} is your sign-in code. It works for 10 minutes.`,
    heading: 'Your sign-in code',
    body: `${paragraph(lead)}
        ${codePanel(code, brand)}
        ${paragraph(ignore, 24)}`,
    footer: ONE_ACCOUNT,
  });
  return { subject, text, html };
}

export async function sendCodeEmail(
  env: Env,
  email: string,
  code: string,
  app: AppSiteId | null = null,
): Promise<void> {
  await sendEmail(env, { to: email, ...codeEmail(code, emailBrand(env, app)) });
}

// The code that confirms closing the account (liveworkspace/docs/specs/003-accounts/sign-in.md "Closing an account"),
// in the frame of the app that asked for it. It says plainly what the code does, so nobody hands it over thinking it
// signs them in, and that ignoring it keeps the account.
export function deletionCodeEmail(code: string, brand: EmailBrand) {
  const name = `live${brand.word}`;
  const subject = `${code} is your code to delete your liveworkspace account`;
  const lead = `Enter this code in ${name} to delete your liveworkspace account and everything you own in every liveworkspace app. It works for 10 minutes.`;
  const ignore =
    'If you didn’t ask to delete your account, ignore this email and don’t share the code: nothing is deleted without it. If you left your account signed in somewhere, sign out there.';
  const text = [
    `Your code to delete your liveworkspace account is ${code}`,
    '',
    lead,
    '',
    ignore,
  ].join('\n');
  const html = frame(brand, {
    preheader: `${code} confirms deleting your account. It works for 10 minutes.`,
    heading: 'Confirm deleting your account',
    body: `${paragraph(lead)}
        ${codePanel(code, brand)}
        ${paragraph(ignore, 24)}`,
    footer: ONE_ACCOUNT,
  });
  return { subject, text, html };
}

export async function sendDeletionCodeEmail(
  env: Env,
  email: string,
  code: string,
  app: AppSiteId | null,
): Promise<void> {
  await sendEmail(env, { to: email, ...deletionCodeEmail(code, emailBrand(env, app)) });
}

const origin = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

// The account's notification settings on liveworkspace.app (this deployment's BASE_URL): the Explorer with the Settings
// panel open on Notifications (liveworkspace/docs/specs/010-site/site.md "Settings"), where every email
// that can be turned off is turned off, for every app. Signed out, it signs them in and comes back.
export function settingsUrl(baseUrl: string): string {
  return `${origin(baseUrl)}/explorer?settings=notifications`;
}

// The page an invitation email's Decline link opens: it reads the token and declines only when its
// button is pressed, so a mail scanner opening the link changes nothing.
export const declineUrl = (baseUrl: string, token: string) =>
  `${origin(baseUrl)}/join/decline?token=${encodeURIComponent(token)}`;

// An invitation to a team, sent when an admin invites an address in the Explorer, and again as a
// reminder (stage 1 to 3) while nobody answers. Accepting happens in the Explorer's Invites, signed in
// with that address; declining needs no account, through the email's own link.
export function teamInviteEmail(
  baseUrl: string,
  teamName: string,
  inviterName: string,
  declineToken: string,
  stage = 0,
) {
  const who = inviterName.trim() || 'Someone';
  const link = `${origin(baseUrl)}/explorer/invites`;
  const decline = declineUrl(baseUrl, declineToken);
  const reminder = stage > 0;
  const subject = reminder
    ? `Reminder: ${who} invited you to ${teamName} on liveworkspace`
    : `${who} invited you to ${teamName} on liveworkspace`;
  const lead = reminder
    ? `A reminder: ${who} invited you to join the team ${teamName} on liveworkspace, and it's still waiting for you.`
    : `${who} invited you to join the team ${teamName} on liveworkspace.`;
  const text = [
    lead,
    '',
    `Accept it at ${link}, signed in with this email address.`,
    `Not for you? Decline it, no account needed: ${decline}`,
    'The team is the same in every liveworkspace app. An invitation nobody answers closes after 28 days.',
  ].join('\n');
  const accept = 'Sign in with this email address to accept it.';
  const footer =
    'The team is the same in every liveworkspace app. An invitation nobody answers closes after 28 days.';
  const team = escapeHtml(teamName);
  const html = frame(workspaceBrand({ BASE_URL: baseUrl }), {
    preheader: escapeHtml(lead),
    heading: reminder ? `A reminder about ${team}` : `You’re invited to ${team}`,
    body: `${paragraph(escapeHtml(lead))}
        ${button('Answer the invitation', escapeHtml(link))}
        ${paragraph(`${accept} Not for you? <a href="${escapeHtml(decline)}" style="color:${INK};text-decoration:underline">Decline the invitation</a>, no account needed.`, 24)}`,
    footer,
  });
  return { subject, text, html };
}

// Each invitation email's kind on `Email·Sent`, by its stage, as the apps' own team emails named them,
// so each app's dashboard keeps counting them in the same charts.
const TEAM_INVITE_SENT_TYPE: Record<number, string> = {
  0: 'TeamInvite',
  1: 'TeamInviteReminder1',
  2: 'TeamInviteReminder2',
  3: 'TeamInviteReminder3',
};

// Sends an invitation, and counts it under `app`, the app the inviter signed up through
// (lifecycle.ts signupAppOf); null, for liveworkspace.app or not known, isn't counted. The count goes
// with the Worker's next flush (telemetry.ts), never holding up the send.
export async function sendTeamInviteEmail(
  env: Env,
  invite: {
    to: string;
    teamName: string;
    inviterName: string;
    declineToken: string;
    stage?: number;
    app: SettingsApp | null;
  },
): Promise<void> {
  const stage = invite.stage ?? 0;
  await sendEmail(env, {
    to: invite.to,
    ...teamInviteEmail(
      env.BASE_URL,
      invite.teamName,
      invite.inviterName,
      invite.declineToken,
      stage,
    ),
  });
  const type = TEAM_INVITE_SENT_TYPE[stage];
  if (invite.app && type) reportServerEvent(env, 'Email', 'Sent', type, invite.app);
}

// To a team's admins when someone accepts or declines an invitation (each can turn it off).
export function inviteResponseEmail(
  baseUrl: string,
  teamName: string,
  responder: string,
  accepted: boolean,
  teamId?: string,
) {
  const verb = accepted ? 'accepted' : 'declined';
  // The team's view in the Explorer, where it is run.
  const link = teamId
    ? `${origin(baseUrl)}/explorer/team?id=${encodeURIComponent(teamId)}`
    : `${origin(baseUrl)}/explorer`;
  const unsubscribeUrl = settingsUrl(baseUrl);
  const subject = `${responder} ${verb} your invitation to ${teamName}`;
  const text = [
    `${responder} ${verb} the invitation to join ${teamName} on liveworkspace.`,
    '',
    `See the team at ${link}.`,
    '',
    `You get this as one of the team's admins. Manage your notifications: ${unsubscribeUrl}`,
  ].join('\n');
  const html = frame(workspaceBrand({ BASE_URL: baseUrl }), {
    preheader: escapeHtml(
      `${responder} ${verb} the invitation to join ${teamName} on liveworkspace.`,
    ),
    heading: accepted ? 'Invitation accepted' : 'Invitation declined',
    body: `${paragraph(`<strong>${escapeHtml(responder)}</strong> ${verb} the invitation to join <strong>${escapeHtml(teamName)}</strong> on liveworkspace.`)}
        ${button('See the team', escapeHtml(link))}`,
    footer: `You get this as one of the team's admins. <a href="${escapeHtml(unsubscribeUrl)}" style="color:${INK};text-decoration:underline">Manage your notifications</a> to turn these off.`,
  });
  return { subject, text, html, unsubscribeUrl };
}

// Each admin's email counts once under `app`, the app the invitation's sender signed up through (null
// isn't counted), as sendTeamInviteEmail does.
export async function sendInviteResponseEmails(
  env: Env,
  recipients: { email: string }[],
  response: {
    teamId?: string;
    teamName: string;
    responder: string;
    accepted: boolean;
    app: SettingsApp | null;
  },
): Promise<void> {
  const email = inviteResponseEmail(
    env.BASE_URL,
    response.teamName,
    response.responder,
    response.accepted,
    response.teamId,
  );
  await Promise.all(
    recipients.map(async (r) => {
      await sendEmail(env, { to: r.email, ...email });
      if (response.app) reportServerEvent(env, 'Email', 'Sent', 'InviteResponse', response.app);
    }),
  );
}

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

// To a token's owner a week before it expires (token-expiry.ts), so a script or connected AI tool
// doesn't stop without warning. An account message, sent once per token: it can't be turned off.
export function tokenExpiringEmail(baseUrl: string, tokenName: string, expiresAt: number) {
  const name = tokenName.trim();
  const which = (n: string) => (name ? `Your API token ${n}` : 'One of your API tokens');
  const d = new Date(expiresAt);
  const when = `${EXPIRY_MONTHS[d.getUTCMonth()]!} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  const link = `${origin(baseUrl)}/explorer?settings=tokens`;
  const subject = 'Your liveworkspace API token expires soon';
  const rest = `expires on ${when}. Once it lapses, any script or connected AI tool using it will stop being able to reach your work in the liveworkspace apps.`;
  const lead = `${which(name)} ${rest}`;
  const steps = [
    'Make a fresh token on your account’s Tokens page before this one expires.',
    'Update whatever uses it (your scripts, or a connected AI tool) with the new token.',
    'Revoke the old token once the switch is done.',
  ];
  const outro = 'Tokens last six months; this is the only reminder we send for each one.';
  const footer =
    'You’re receiving this because an API token on your liveworkspace account is nearing its expiry.';
  const text = [
    lead,
    '',
    ...steps.map((s) => `- ${s}`),
    '',
    `Manage your tokens: ${link}`,
    '',
    outro,
    footer,
  ].join('\n');
  const html = frame(workspaceBrand({ BASE_URL: baseUrl }), {
    preheader: escapeHtml(lead),
    heading: 'Your API token expires soon',
    body: `${paragraph(`${which(`<strong>${escapeHtml(name)}</strong>`)} ${rest}`)}
        ${list(steps, true)}
        ${button('Manage your tokens', escapeHtml(link))}
        ${paragraph(outro, 24)}`,
    footer,
  });
  return { subject, text, html };
}
