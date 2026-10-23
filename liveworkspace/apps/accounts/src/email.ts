import type { Env } from './env.ts';
import type { SettingsApp } from './settings.ts';
import { reportServerEvent } from './telemetry.ts';

// Every email goes through Resend, the same provider the apps use. Without RESEND_API_KEY a
// development Worker prints the message to its log instead (the code is in the subject), so local
// sign-in works without a key; staging and production refuse, so a missing key is never silent.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// The longest a send may wait on Resend, which answers in well under a second. A sign-in code is
// sent while the person waits on the page, so a hung call must not hold the request for long.
export const EMAIL_SEND_TIMEOUT_MS = 10_000;

type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Where to turn this kind of email off, sent as List-Unsubscribe so mail clients can offer it.
  unsubscribeUrl?: string;
};

export async function sendEmail(env: Env, email: Email): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (env.ENVIRONMENT !== 'development') throw new Error('RESEND_API_KEY is not set');
    console.log(`[email] To: ${email.to} Subject: ${email.subject}`);
    return;
  }
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: `liveworkspace <${env.EMAIL_FROM}>`,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(email.unsubscribeUrl && {
        headers: { 'List-Unsubscribe': `<${email.unsubscribeUrl}>` },
      }),
    }),
    signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`);
  }
}

export function codeEmail(code: string) {
  const subject = `${code} is your liveworkspace sign-in code`;
  const text = [
    `Your sign-in code is ${code}`,
    '',
    'It works for 10 minutes. If you did not try to sign in, you can ignore this email.',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111;padding:24px">
<p>Your liveworkspace sign-in code is</p>
<p style="font-size:32px;font-weight:600;letter-spacing:6px;margin:16px 0">${code}</p>
<p style="color:#555">It works for 10 minutes. If you did not try to sign in, you can ignore this email.</p>
</body></html>`;
  return { subject, text, html };
}

export async function sendCodeEmail(env: Env, email: string, code: string): Promise<void> {
  await sendEmail(env, { to: email, ...codeEmail(code) });
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const origin = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

// The account's settings page on liveworkspace.app (this deployment's BASE_URL), where every email
// that can be turned off is turned off, for every app. Signed out, it signs them in and comes back.
export function settingsUrl(baseUrl: string): string {
  return `${origin(baseUrl)}/account/settings`;
}

// The page an invitation email's Decline link opens: it reads the token and declines only when its
// button is pressed, so a mail scanner opening the link changes nothing.
export const declineUrl = (baseUrl: string, token: string) =>
  `${origin(baseUrl)}/join/decline?token=${encodeURIComponent(token)}`;

// An invitation to a team, sent when an admin invites an address on liveworkspace.app, and again as a
// reminder (stage 1 to 3) while nobody answers. Accepting happens there, signed in with that address;
// declining needs no account, through the email's own link.
export function teamInviteEmail(
  baseUrl: string,
  teamName: string,
  inviterName: string,
  declineToken: string,
  stage = 0,
) {
  const who = inviterName.trim() || 'Someone';
  const link = `${origin(baseUrl)}/account/teams`;
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
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111;padding:24px">
<p>${escapeHtml(lead)}</p>
<p style="margin:24px 0"><a href="${link}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Answer the invitation</a></p>
<p style="color:#555">Sign in with this email address to accept it. Not for you? <a href="${decline}" style="color:#555">Decline the invitation</a>, no account needed.</p>
<p style="color:#555">The team is the same in every liveworkspace app. An invitation nobody answers closes after 28 days.</p>
</body></html>`;
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
) {
  const verb = accepted ? 'accepted' : 'declined';
  const link = `${origin(baseUrl)}/account/teams`;
  const unsubscribeUrl = settingsUrl(baseUrl);
  const subject = `${responder} ${verb} your invitation to ${teamName}`;
  const text = [
    `${responder} ${verb} the invitation to join ${teamName} on liveworkspace.`,
    '',
    `See the team at ${link}.`,
    '',
    `You get this as one of the team's admins. Manage your notifications: ${unsubscribeUrl}`,
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111;padding:24px">
<p><strong>${escapeHtml(responder)}</strong> ${verb} the invitation to join <strong>${escapeHtml(teamName)}</strong> on liveworkspace.</p>
<p style="margin:24px 0"><a href="${link}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">See the team</a></p>
<p style="color:#555">You get this as one of the team's admins. <a href="${unsubscribeUrl}" style="color:#555">Manage your notifications</a> to turn these off.</p>
</body></html>`;
  return { subject, text, html, unsubscribeUrl };
}

// Each admin's email counts once under `app`, the app the invitation's sender signed up through (null
// isn't counted), as sendTeamInviteEmail does.
export async function sendInviteResponseEmails(
  env: Env,
  recipients: { email: string }[],
  response: { teamName: string; responder: string; accepted: boolean; app: SettingsApp | null },
): Promise<void> {
  const email = inviteResponseEmail(
    env.BASE_URL,
    response.teamName,
    response.responder,
    response.accepted,
  );
  await Promise.all(
    recipients.map(async (r) => {
      await sendEmail(env, { to: r.email, ...email });
      if (response.app) reportServerEvent(env, 'Email', 'Sent', 'InviteResponse', response.app);
    }),
  );
}
