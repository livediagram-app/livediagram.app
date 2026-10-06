// The verbs the CLI handles itself (blueprint CLI55): guides, the skill, the api escape hatch, and auth.

import {
  GUIDE_TOPIC_NAMES,
  GUIDE_TOPICS,
  isGuideTopic,
  renderSkill,
  SKILL_DIRECTORIES,
  SKILL_NAME,
} from '@livediagram/agent-verbs';
import { discover, loginWithBrowser, loginWithDevice } from '../auth/oauth';
import type { DebugLog } from '../debug';
import type { ApiClient } from '@livediagram/api-client';
import { isApiTokenFormat, type CurrentTokenResponse } from '@livediagram/api-schema';
import { forgetCredential, storeCredential, storedCredential } from '../auth/credentials';
import type { Profile } from '../config/profiles';
import { inputReader } from '../input';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';

export function guideOf(topic: string | undefined): { text: string } {
  if (topic === undefined || !isGuideTopic(topic))
    return {
      text: [
        'Guides: livediagram guide <topic>',
        ...GUIDE_TOPIC_NAMES.map((t) => `  ${t.padEnd(12)}${GUIDE_TOPICS[t].summary}`),
      ].join('\n'),
    };
  return { text: GUIDE_TOPICS[topic].text };
}

const expandHome = (io: CliIo, dir: string) =>
  dir.startsWith('~/') ? `${io.homedir}${dir.slice(1)}` : dir;

export async function installSkill(io: CliIo, to: string | undefined): Promise<{ path: string }> {
  if (!to)
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: 'skill install needs --to <dir>, the skills directory of your agent',
      lines: SKILL_DIRECTORIES.map((d) => `${d.path.padEnd(20)}${d.agent}`),
      hint: `livediagram skill install --to ${SKILL_DIRECTORIES[0]!.path}`,
    });
  const dir = `${expandHome(io, to)}/${SKILL_NAME}`;
  const path = `${dir}/SKILL.md`;
  const existing = await io.files.read(path);
  if (existing !== null && !new RegExp(`^---\\n(?:.*\\n)*?name: ${SKILL_NAME}\\n`).test(existing))
    throw new CliError({
      exit: EXIT.rejected,
      code: 'invalid_value',
      message: `${path} holds another skill; not overwritten`,
      hint: 'choose another directory with --to',
    });
  await io.files.mkdir(dir);
  await io.files.write(path, renderSkill());
  return { path };
}

const API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// `api <method> <path>`: any route on the active host, the token never leaving it (CLI53); a whole-tab
// save is refused (I4).
export async function callApi(
  io: CliIo,
  api: ApiClient,
  input: { method: string; path: string; body?: string },
): Promise<{ text: string; status: number }> {
  const method = input.method.toUpperCase();
  const usage = (message: string, hint = 'livediagram api --help') =>
    new CliError({ exit: EXIT.usage, code: 'usage', message, hint });
  if (!API_METHODS.includes(method))
    throw usage(`${input.method} is not one of ${API_METHODS.join(', ')}`);
  if (/^[a-z]+:/i.test(input.path) || input.path.startsWith('//'))
    throw usage(`${input.path} is a URL; give a path under /api, such as /documents`);
  const path = `/${input.path.replace(/^\/+/, '').replace(/^api\//, '')}`;
  if (method === 'PUT' && /^\/documents\/[^/]*\/tabs\/[^/]*\/?$/.test(path.split('?')[0]!))
    throw usage(
      'the CLI never saves a whole tab; change a tab with a changeset',
      'livediagram guide edit',
    );
  const body = input.body === undefined ? undefined : await inputReader(io)(input.body);
  const res = await api.fetch(path, { method, ...(body ? { body } : {}) });
  return { text: await res.text(), status: res.status };
}

// A token from stdin (`--with-token`): never read from a terminal, and only an lvd_ token.
async function tokenFromStdin(io: CliIo): Promise<string> {
  if (io.stdinIsTTY)
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: '--with-token reads the token from stdin, not a terminal',
      hint: 'printf %s "$TOKEN" | livediagram auth login --with-token',
    });
  const token = (await io.readStdin()).trim();
  if (!isApiTokenFormat(token))
    throw new CliError({
      exit: EXIT.rejected,
      code: 'invalid_value',
      message: 'that is not an API token (lvd_…)',
    });
  return token;
}

export type LoginInput = { withToken?: boolean; device?: boolean };

// Sign in (blueprint "Credentials"): a token by the browser (default), the device grant (`--device`) or stdin
// (`--with-token`); checked with the api, stored, and the token it replaces revoked.
export async function login(
  io: CliIo,
  profile: Profile,
  api: (token: string) => ApiClient,
  input: LoginInput,
  oauthIssuer: string | undefined,
  log: DebugLog,
): Promise<{ host: string; account: string }> {
  if (input.withToken && input.device)
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: 'give --with-token or --device, not both',
    });
  let token: string;
  if (input.withToken) token = await tokenFromStdin(io);
  else {
    if (!oauthIssuer)
      throw new CliError({
        exit: EXIT.auth,
        code: 'auth',
        message: `${profile.host} offers no browser sign-in`,
        hint: 'create a token in Settings › API Tokens, then pipe it to: livediagram auth login --with-token',
      });
    const server = await discover(io, oauthIssuer, log);
    token = input.device
      ? await loginWithDevice(io, server, log)
      : await loginWithBrowser(io, server, log);
  }
  const current = await api(token).json<CurrentTokenResponse>('/tokens/current');
  const previous = await storedCredential(io, profile.name);
  await storeCredential(io, profile.name, {
    host: profile.host,
    token,
    tokenId: current.tokenId,
    accountName: current.accountName,
    role: current.role,
    expiresAt: current.expiresAt,
  });
  if (previous && previous.tokenId !== current.tokenId) {
    const revoked = await api(previous.token)
      .fetch('/tokens/current', { method: 'DELETE' })
      .catch(() => null);
    if (!revoked?.ok)
      io.stderr(
        'warning: the previous token could not be revoked; revoke it in Settings › API Tokens\n',
      );
  }
  return { host: profile.host, account: current.accountName ?? current.accountId };
}

export const TOKEN_EXPIRY_WARN_DAYS = 14;
const DAY_MS = 86_400_000;

export async function status(io: CliIo, profile: Profile, api: ApiClient, source: 'env' | 'file') {
  const current = await api.json<CurrentTokenResponse>('/tokens/current');
  const days =
    current.expiresAt === null ? null : Math.floor((current.expiresAt - io.now()) / DAY_MS);
  if (days !== null && days < TOKEN_EXPIRY_WARN_DAYS)
    io.stderr(`this token expires in ${days} days: livediagram auth login to renew\n`);
  return {
    host: profile.host,
    account: current.accountName ?? current.accountId,
    token: current.tokenName ?? current.tokenId,
    role: current.role,
    expires:
      current.expiresAt === null
        ? 'never'
        : `${new Date(current.expiresAt).toISOString().slice(0, 10)} (in ${days} days)`,
    source,
  };
}

// Revokes the stored token, then forgets it; a 401 forgets too (CLI38). The env token is not the CLI's.
export async function logout(io: CliIo, profile: Profile, api: ApiClient, source: 'env' | 'file') {
  if (source === 'env')
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: "LIVEDIAGRAM_TOKEN is set; it is not the CLI's to revoke",
      hint: 'unset LIVEDIAGRAM_TOKEN, or revoke the token in Settings › API Tokens',
    });
  const res = await api.fetch('/tokens/current', { method: 'DELETE' });
  if (!res.ok && res.status !== 401 && res.status !== 404)
    throw new CliError({
      exit: EXIT.failure,
      code: 'server',
      message: `${profile.host} failed (HTTP ${res.status})`,
      hint: 'retry shortly',
    });
  await forgetCredential(io, profile.name);
  return { host: profile.host };
}
