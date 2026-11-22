// Steps in other apps (liveworkspace/docs/specs/018-automations/automations.md "Steps in other apps"; blueprint
// cross-app.md "The index"): an item's room asks here when one of its rules acts on another app's item.
//
//   POST /app/items/:id/automation-steps  {key, author, rule, from, chain, step}  → 200 AutomationStepAnswer
//   GET  /items/:id/automation-target                                            → 200 AutomationTargetDescription
//
// The push is the source item's own app's (app-routes.ts). The index checks, in order: the chain (the same rule
// twice, a fourth hop), the author's day (500 steps), the author's access to the target as it checks anyone's
// (`loadItem`: owner, team read fresh, a live link, the Trash), then signs the author's grant at that level and asks
// the target's app through its internal door, which checks the grant itself before it writes. Every refusal is an
// answer (200), never an error, so the rule's line says why; a target the author cannot reach is `no_access`
// whatever the reason, so a rule learns nothing of an item it cannot see. A Notify stops here: its notices are the
// index's own rows (automation-step-notices.ts).
//
// The target read is a person's: the pickers ask what an item offers (its boards, pages, templates or tabs) through
// its own app, with the person's own grant, an Editor's alone.

import {
  automationTargetDoorPath,
  CROSS_APP_AUTHOR_DAY_MAX,
  CROSS_APP_HOPS_MAX,
  CROSS_APP_KIND_APPS,
  CROSS_APP_NEED,
  CROSS_APP_CHAIN_RULES_MAX,
  isCrossAppKind,
  isCrossAppRefusal,
  ITEM_GRANT_HEADER,
  ruleKeyOf,
  type App,
  type AutomationStepAnswer,
  type AutomationStepDoorCall,
  type CrossAppChain,
  type CrossAppRefusal,
  type CrossAppTargetedStep,
  type Level,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { callAppForJson } from './app-calls';
import type { Caller } from './auth';
import { isId } from './codec';
import { APP_CALL_TIMEOUT_MS } from './config';
import type { Env } from './env';
import { mintGrant } from './grants';
import { badRequest, json, readObject } from './http';
import { pushAutomationNotices } from './automation-step-notices';

const DAY_MS = 86_400_000;
const KEY_MAX = 300;
const NAME_MAX = 200;
const URL_MAX = 2048;
// A step's JSON, as the index passes it on: the target app reads it whole.
const STEP_BYTES_MAX = 64 * 1024;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const short = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isAccount = (v: unknown): v is string =>
  typeof v === 'string' && isId(v) && v.startsWith('user_') && !v.includes(':');

const answer = (a: AutomationStepAnswer) => json(a);
const refused = (code: CrossAppRefusal, reason = '') => answer({ ok: false, code, reason });

function readChainOf(v: unknown): CrossAppChain | null {
  if (!isRecord(v) || !short(v.id, 100) || v.id === '') return null;
  if (
    !Number.isInteger(v.hops) ||
    (v.hops as number) < 0 ||
    (v.hops as number) > CROSS_APP_HOPS_MAX
  )
    return null;
  if (
    !Array.isArray(v.rules) ||
    v.rules.length > CROSS_APP_CHAIN_RULES_MAX ||
    !v.rules.every((r) => short(r, KEY_MAX) && r !== '')
  )
    return null;
  return { id: v.id, hops: v.hops as number, rules: v.rules as string[] };
}

type Push = {
  key: string;
  author: string;
  rule: { id: string; name: string };
  from: { title: string; url: string };
  chain: CrossAppChain;
  step: Record<string, unknown> & { kind: string };
};

function readPush(body: Record<string, unknown> | null): Push | null {
  if (!body) return null;
  const { key, author, rule, from, step } = body;
  const chain = readChainOf(body.chain);
  if (!short(key, KEY_MAX) || key === '' || !isAccount(author) || !chain) return null;
  if (!isRecord(rule) || !short(rule.id, NAME_MAX) || rule.id === '' || !short(rule.name, NAME_MAX))
    return null;
  if (!isRecord(from) || !short(from.title, NAME_MAX) || !short(from.url, URL_MAX)) return null;
  if (!isRecord(step) || !isCrossAppKind(step.kind)) return null;
  if (JSON.stringify(step).length > STEP_BYTES_MAX) return null;
  return {
    key,
    author,
    rule: { id: rule.id, name: rule.name },
    from: { title: from.title, url: from.url },
    chain,
    step: step as Push['step'],
  };
}

const dayOf = (now: number) => Math.floor(now / DAY_MS);

/** The author's steps in other apps today. */
async function stepsToday(env: Env, author: string, now: number): Promise<number> {
  const row = await env.INDEX_DB.prepare(
    'SELECT count FROM automation_step_days WHERE person_id = ? AND day = ?',
  )
    .bind(author, dayOf(now))
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/** One more step today for the author, and yesterday's rows before that gone (on a day's first write only). */
export async function countStep(env: Env, author: string, now: number): Promise<number> {
  const day = dayOf(now);
  const row = await env.INDEX_DB.prepare(
    `INSERT INTO automation_step_days (person_id, day, count) VALUES (?, ?, 1)
     ON CONFLICT (person_id, day) DO UPDATE SET count = count + 1 RETURNING count`,
  )
    .bind(author, day)
    .first<{ count: number }>();
  const count = row?.count ?? 1;
  if (count === 1)
    await env.INDEX_DB.prepare('DELETE FROM automation_step_days WHERE day < ?')
      .bind(day - 1)
      .run();
  return count;
}

// The author as the access rule reads them: an account, their teams read fresh from accounts where an item's team
// is not in their (empty) claim.
const authorCaller = (author: string): Caller => ({
  person: { id: author, kind: 'account', teams: [] },
  share: null,
});

// The answer a target's door gave, read: anything that is not one is a failure.
function readAnswer(body: Record<string, unknown>): AutomationStepAnswer {
  if (body.ok === true && typeof body.text === 'string')
    return {
      ok: true,
      text: body.text.slice(0, NAME_MAX * 2),
      ...(typeof body.link === 'string' && body.link.length <= URL_MAX ? { link: body.link } : {}),
    };
  if (body.ok === false && isCrossAppRefusal(body.code))
    return {
      ok: false,
      code: body.code,
      reason: typeof body.reason === 'string' ? body.reason.slice(0, NAME_MAX * 2) : '',
    };
  return { ok: false, code: 'failed', reason: '' };
}

/** POST /app/items/:id/automation-steps, from the source item's own app (app-routes.ts refuses any other). */
export async function pushAutomationStep(
  env: Env,
  sourceId: string,
  app: App,
  request: Request,
  now = Date.now(),
): Promise<Response> {
  const push = readPush(await readObject(request));
  if (!push) return badRequest('invalid_step');
  const ruleKey = ruleKeyOf(app, sourceId, push.rule.id);
  if (push.chain.rules.includes(ruleKey)) return refused('loop');
  if (push.chain.hops >= CROSS_APP_HOPS_MAX) return refused('chain_long');
  if ((await stepsToday(env, push.author, now)) >= CROSS_APP_AUTHOR_DAY_MAX)
    return refused('capped');

  if (push.step.kind === 'inbox_notice') {
    const sent = await pushAutomationNotices(env, sourceId, app, push, now);
    if (sent.ok) await countStep(env, push.author, now);
    return answer(sent);
  }
  const step = push.step as unknown as CrossAppTargetedStep;
  const target = isRecord(step.target) ? step.target : null;
  const apps: readonly string[] = CROSS_APP_KIND_APPS[step.kind];
  if (!target || !isId(target.item) || !apps.includes(String(target.app)))
    return refused('invalid', 'The step names no item it can act on');
  if (target.item === sourceId)
    return refused('invalid', 'A rule acts on its own item with its own steps');

  const loaded = await loadItem(env, target.item, authorCaller(push.author), CROSS_APP_NEED);
  if (loaded instanceof Response) {
    await loaded.body?.cancel();
    return refused('no_access');
  }
  const { row, access } = loaded;
  // An item in the Trash or archived runs nothing and takes nothing; one of another app is not this step's.
  if (row.trashed_at !== null || row.archived_at !== null || access.tabId !== null)
    return refused('no_access');
  if (row.app !== target.app)
    return refused('invalid', 'The item is not of the app the step names');

  const grant = await mintGrant(env, {
    app: row.app,
    sub: push.author,
    itemId: row.id,
    level: access.level,
    tabId: null,
    ownerId: row.owner_id,
    teamId: row.team_id,
    link: access.code,
  });
  if (!grant) return refused('unavailable');
  const call: AutomationStepDoorCall = {
    author: push.author,
    rule: { id: push.rule.id, name: push.rule.name, app, item: sourceId },
    from: push.from,
    // The chain the target's write carries on: one hop more, this rule added.
    chain: {
      id: push.chain.id,
      hops: push.chain.hops + 1,
      rules: [...push.chain.rules, ruleKey].slice(-CROSS_APP_CHAIN_RULES_MAX),
    },
    step,
  };
  const res = await callAppForJson(
    env,
    row.app,
    `/items/${encodeURIComponent(row.id)}/automation-step`,
    call,
    APP_CALL_TIMEOUT_MS,
    { [ITEM_GRANT_HEADER]: grant.grant },
  );
  if (!res.ok) {
    console.warn('[index] automation step not taken', { app: row.app, error: res.error });
    // The app's own grant check refused it, or the item is gone from it: the author has no access there.
    if (res.error === 'status_403' || res.error === 'status_404') return refused('no_access');
    return refused('unavailable');
  }
  const answered = readAnswer(res.body);
  if (answered.ok) await countStep(env, push.author, now);
  console.info('[index] automation step', { kind: step.kind, ok: answered.ok });
  return answer(answered);
}

/** GET /items/:id/automation-target: what the item offers a step's pickers, read through its own app as the caller
 *  (an Editor of the whole item). */
export async function readAutomationTarget(
  env: Env,
  id: string,
  caller: Caller,
): Promise<Response> {
  const loaded = await loadItem(env, id, caller, 'edit' satisfies Level);
  if (loaded instanceof Response) return loaded;
  const { row, access } = loaded;
  const person = caller.person;
  if (!person || person.kind !== 'account' || access.tabId !== null)
    return json({ error: 'forbidden' }, { status: 403 });
  const grant = await mintGrant(env, {
    app: row.app,
    sub: person.id,
    itemId: row.id,
    level: access.level,
    tabId: null,
    ownerId: row.owner_id,
    teamId: row.team_id,
    link: access.code,
  });
  if (!grant) return json({ error: 'grants_unavailable' }, { status: 503 });
  const res = await callAppForJson(
    env,
    row.app,
    automationTargetDoorPath(row.id).slice('/api/internal'.length),
    { author: person.id },
    APP_CALL_TIMEOUT_MS,
    { [ITEM_GRANT_HEADER]: grant.grant },
  );
  if (!res.ok) return json({ error: 'target_unavailable' }, { status: 502 });
  return json({ ...res.body, app: row.app, title: row.title });
}
