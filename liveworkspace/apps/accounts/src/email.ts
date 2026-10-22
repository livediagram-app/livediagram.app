import type { Env } from './env.ts';

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
  await env.EMAIL.send({
    from: { name: 'liveworkspace', email: env.EMAIL_FROM },
    to: email,
    ...codeEmail(code),
  });
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// An invitation to a team, sent when an admin invites an address on liveworkspace.app. Answering it
// happens there, signed in with that address.
export function teamInviteEmail(baseUrl: string, teamName: string, inviterName: string) {
  const who = inviterName.trim() || 'Someone';
  const link = `${baseUrl.replace(/\/+$/, '')}/account/teams`;
  const subject = `${who} invited you to ${teamName} on liveworkspace`;
  const text = [
    `${who} invited you to join the team ${teamName} on liveworkspace.`,
    '',
    `Accept or decline it at ${link}, signed in with this email address.`,
    'The team is the same in every liveworkspace app. If you were not expecting this, you can ignore it.',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111;padding:24px">
<p>${escapeHtml(who)} invited you to join the team <strong>${escapeHtml(teamName)}</strong> on liveworkspace.</p>
<p style="margin:24px 0"><a href="${link}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Answer the invitation</a></p>
<p style="color:#555">Sign in with this email address to accept or decline it. The team is the same in every liveworkspace app. If you were not expecting this, you can ignore it.</p>
</body></html>`;
  return { subject, text, html };
}

export async function sendTeamInviteEmail(
  env: Env,
  invite: { to: string; teamName: string; inviterName: string },
): Promise<void> {
  await env.EMAIL.send({
    from: { name: 'liveworkspace', email: env.EMAIL_FROM },
    to: invite.to,
    ...teamInviteEmail(env.BASE_URL, invite.teamName, invite.inviterName),
  });
}
