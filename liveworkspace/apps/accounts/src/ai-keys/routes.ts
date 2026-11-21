// The account API's AI key routes (liveworkspace/docs/specs/003-accounts/ai-keys.md "The account API"), on both doors:
// the session on liveworkspace.app and an account's bearer through an app's router. Both doors have already refused a
// guest, an API token and a cross-origin write before these run. A key comes in once, in a PUT's body, and never goes
// out: every answer is the state (`AiKeyState`), the hint only to whoever may change the key.
import {
  MODEL_PROVIDERS,
  checkProviderKey,
  isModelProviderId,
  isProviderModel,
  modelProvider,
  providerFetch,
  type KeyProviderId,
  type ModelFailureKind,
} from '@liveworkspace/ai';
import { accountName } from '../account-api/shared.ts';
import { error, json, readBody, type WaitUntil } from '../account-api/http.ts';
import type { Env } from '../env.ts';
import { getMembership } from '../teams.ts';
import { sendAiKeyChanged, teamAiKeyEvent, type AiKeyChange } from './notify.ts';
import { aiKeyHint, aiKeySecrets, isAiKeyShaped, sealAiKey, type AiKeyOwner } from './seal.ts';
import {
  deleteAiKeyStatement,
  readAiKey,
  readTeamAiKeys,
  saveAiKeyStatement,
  setAiModelStatement,
  stateOf,
  type AiKeyOwnerKind,
} from './store.ts';

export type AiKeyDeps = {
  // The provider check's way out: the global fetch, through providerFetch (tests hand in a fake).
  fetch?: typeof fetch;
  now?: () => number;
};

/** The providers and their models, as Settings lists them: the one list, @liveworkspace/ai's. */
export const AI_PROVIDERS = MODEL_PROVIDERS.map((p) => ({
  id: p.id,
  label: p.name,
  keyPrefix: p.keyPrefix,
  defaultModel: p.defaultModel,
  models: p.models.map((m) => ({ id: m.id, label: m.name })),
}));

// A provider's answer to the key check, as the routes refuse it.
const CHECK_REFUSAL: Partial<Record<ModelFailureKind, [number, string]>> = {
  'bad-key': [422, 'key_rejected'],
  'no-credit': [422, 'key_no_credit'],
  'model-unavailable': [422, 'key_model_unavailable'],
};

type Owner = { kind: AiKeyOwnerKind; id: string; teamName?: string };

async function readState(env: Env, userId: string) {
  const db = env.AUTH_DB;
  const [own, teams] = await Promise.all([
    readAiKey(db, 'account', userId),
    readTeamAiKeys(db, userId),
  ]);
  return {
    available: aiKeySecrets(env) !== null,
    key: own ? stateOf(own) : null,
    teams: teams.map((team) => {
      const canManage = team.role === 'admin';
      const state = team.key ? stateOf(team.key) : null;
      // A member uses the team's key and is told it is there; only its admins see its ending.
      return {
        id: team.id,
        name: team.name,
        canManage,
        key: state && !canManage ? { ...state, hint: '' } : state,
      };
    }),
    providers: AI_PROVIDERS,
  };
}

/** The AI key routes: `['ai-key']` and `['teams', id, 'ai-key']`. Null for any other path. */
export async function aiKeyRoutes(
  request: Request,
  env: Env,
  actor: { id: string },
  parts: string[],
  waitUntil: WaitUntil,
  deps: AiKeyDeps = {},
): Promise<Response | null> {
  const personal = parts.length === 1 && parts[0] === 'ai-key';
  const team = parts.length === 3 && parts[0] === 'teams' && parts[2] === 'ai-key';
  if (!personal && !team) return null;
  const { method } = request;
  const db = env.AUTH_DB;
  if (personal && method === 'GET') return json(await readState(env, actor.id));
  if (method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE')
    return error(405, 'method_not_allowed');

  let owner: Owner = { kind: 'account', id: actor.id };
  if (team) {
    const me = await getMembership(db, parts[1]!, actor.id);
    if (!me) return error(404, 'not_found');
    if (me.role !== 'admin') return error(403, 'admin_only');
    owner = { kind: 'team', id: parts[1]!, teamName: me.teamName };
  }
  const secrets = aiKeySecrets(env);
  if (!secrets) return error(503, 'ai_keys_unavailable');
  if (
    env.AI_KEY_WRITE_LIMITER &&
    !(await env.AI_KEY_WRITE_LIMITER.limit({ key: `write:${actor.id}` })).success
  ) {
    return error(429, 'rate_limited');
  }
  const now = (deps.now ?? Date.now)();
  const stored = await readAiKey(db, owner.kind, owner.id);

  // Who changed it and how, for the audit log and the email; read only for a change that tells.
  const told = async (change: AiKeyChange, provider: KeyProviderId) => {
    const name = await accountName(db, actor.id);
    return {
      event:
        owner.kind === 'team'
          ? [
              teamAiKeyEvent(db, {
                teamId: owner.id,
                teamName: owner.teamName!,
                actor: { id: actor.id, name },
                change,
                provider,
                at: now,
              }),
            ]
          : [],
      email: () => {
        if (change === 'model') return;
        waitUntil(
          sendAiKeyChanged(env, owner, {
            change,
            provider,
            actorName: name,
            at: now,
            ...(owner.teamName ? { teamName: owner.teamName } : {}),
          }),
        );
      },
    };
  };

  if (method === 'DELETE') {
    if (!stored) return error(404, 'no_key');
    const tell = await told('removed', stored.provider);
    await db.batch([deleteAiKeyStatement(db, owner.kind, owner.id), ...tell.event]);
    console.info('[ai-keys] removed', { kind: owner.kind, provider: stored.provider });
    tell.email();
    return json(await readState(env, actor.id));
  }

  // The body is read here and nowhere logged: a PUT's holds the key.
  const body = await readBody(request);
  if (method === 'PATCH') {
    if (!stored) return error(404, 'no_key');
    if (!isProviderModel(stored.provider, body.model)) return error(400, 'invalid_model');
    const tell = await told('model', stored.provider);
    await db.batch([
      setAiModelStatement(db, owner.kind, owner.id, body.model as string),
      ...tell.event,
    ]);
    console.info('[ai-keys] model', { kind: owner.kind, provider: stored.provider });
    return json(await readState(env, actor.id));
  }

  if (!isModelProviderId(body.provider)) return error(400, 'invalid_provider');
  const provider = body.provider;
  const model = body.model === undefined ? modelProvider(provider).defaultModel : body.model;
  if (!isProviderModel(provider, model)) return error(400, 'invalid_model');
  const apiKey = typeof body.key === 'string' ? body.key.trim() : '';
  if (!isAiKeyShaped(apiKey)) return error(400, 'invalid_key');
  const check = await checkProviderKey({
    provider,
    apiKey,
    model: model as string,
    fetch: providerFetch(provider, deps.fetch),
  });
  if (!check.ok) {
    console.warn('[ai-keys] check failed', { provider, kind: check.kind });
    const [status, code] = CHECK_REFUSAL[check.kind] ?? [502, 'key_check_failed'];
    return error(status, code);
  }
  const ownerKey = `${owner.kind}:${owner.id}` as AiKeyOwner;
  const { sealed, version } = await sealAiKey(secrets, ownerKey, provider, apiKey);
  const tell = await told(stored ? 'replaced' : 'set', provider);
  await db.batch([
    saveAiKeyStatement(db, {
      ownerKind: owner.kind,
      ownerId: owner.id,
      provider,
      model: model as string,
      sealed,
      keyVersion: version,
      hint: aiKeyHint(apiKey),
      setBy: actor.id,
      setAt: now,
    }),
    ...tell.event,
  ]);
  console.info('[ai-keys] saved', { kind: owner.kind, provider });
  tell.email();
  return json(await readState(env, actor.id));
}
