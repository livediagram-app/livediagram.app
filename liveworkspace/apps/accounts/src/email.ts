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
