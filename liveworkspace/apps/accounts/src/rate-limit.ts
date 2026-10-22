import type { Env } from './env.ts';

// True when this code request should be refused. Two limits:
// - per IP, on sending and on checking codes, so one machine can't hammer either;
// - per email address, on sending only, so nobody can flood someone's inbox with codes
//   from many IPs. Guessing is bounded separately: each code allows 3 tries, then dies.
export async function overCodeLimit(
  request: Request,
  env: Env,
  sending: boolean,
): Promise<boolean> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!(await env.CODE_IP_LIMITER.limit({ key: `ip:${ip}` })).success) return true;
  if (!sending) return false;

  const email = await emailOf(request);
  // No email: let Better Auth reject the body with its own validation error.
  if (!email) return false;
  return !(await env.CODE_EMAIL_LIMITER.limit({ key: `email:${email}` })).success;
}

async function emailOf(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}
