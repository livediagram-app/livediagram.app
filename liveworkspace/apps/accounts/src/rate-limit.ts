import {
  WORKSPACE_CLIENT_IP_HEADER,
  WORKSPACE_PROXY_HEADER,
} from '@liveworkspace/sites/workspace-proxy';
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
  if (!(await env.CODE_IP_LIMITER.limit({ key: `ip:${networkOf(request)}` })).success) return true;
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

// The visitor's network. A sign-in on an app's own address reaches this Worker through the app's router, whose request
// comes from the router, not the visitor; the router names the visitor's address (@liveworkspace/sites/workspace-proxy),
// and that is counted instead, apart from direct visitors. A caller could name any address there, but each code still
// needs Turnstile to send and allows three tries, and the per-address limit holds whatever the network.
export function networkOf(request: Request): string {
  const proxied = request.headers.get(WORKSPACE_PROXY_HEADER);
  const client = request.headers.get(WORKSPACE_CLIENT_IP_HEADER);
  if (proxied && client) return `via:${client}`;
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}
