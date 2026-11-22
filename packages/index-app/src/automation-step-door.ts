// A rule's step in another app, as its target app takes it (liveworkspace/docs/specs/018-automations/automations.md
// "Steps in other apps"; blueprint cross-app.md "The door"). The index calls, with the app's key and the author's
// grant (X-Index-Grant):
//
//   POST /api/internal/items/:id/automation-step    AutomationStepDoorCall  → 200 AutomationStepAnswer
//   POST /api/internal/items/:id/automation-target  {author}                → 200 what the pickers offer
//
// The door checks the grant itself before anything runs: for this item, of the author the call names, an Editor's
// on the whole item, not one in the Trash. A grant that is missing, forged, expired or anything less is a 403, which
// the index answers as no access. Every answer after that is the app's handler's; a throw is a failure, never a 500.

import {
  isCrossAppKind,
  ITEM_GRANT_HEADER,
  type AutomationStepAnswer,
  type AutomationStepDoorCall,
  type AutomationTargetDescription,
  type GrantClaims,
} from '@liveworkspace/index-client';
import { badRequest, bodyOf, json } from './internal-doors';

// The handler gets the author's grant, checked: an app runs the step through its own route as them with it.
export type AutomationStepHandler = (
  itemId: string,
  call: AutomationStepDoorCall,
  claims: GrantClaims,
  // The grant itself, for an app that hands it on to its own route (itemGrantOf).
  grant: string,
) => Promise<AutomationStepAnswer>;

export type AutomationTargetHandler = (
  itemId: string,
  author: string,
  grant: GrantClaims,
) => Promise<Omit<AutomationTargetDescription, 'app' | 'title'>>;

export type AutomationDoorGrants = (
  grant: string | null,
  itemId: string,
) => Promise<GrantClaims | null>;

const STEP_BYTES_MAX = 64 * 1024;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

/** Whether the grant lets its author write here as an automation: theirs, an Editor's, the whole item, out of the
 *  Trash. */
export const grantWrites = (
  claims: GrantClaims | null,
  author: string,
  itemId: string,
): claims is GrantClaims =>
  !!claims &&
  claims.sub === author &&
  claims.item === itemId &&
  claims.level === 'edit' &&
  claims.tab === null &&
  !claims.trashed;

/** The door call as the index sends it, or null. The step's own fields are the handler's to read. */
export function readDoorCall(body: unknown): AutomationStepDoorCall | null {
  if (!isRecord(body) || !text(body['author'], 200)) return null;
  const { rule, from, chain, step } = body;
  if (!isRecord(rule) || !text(rule['id'], 200) || !text(rule['name'], 200)) return null;
  if (!text(rule['app'], 40) || !text(rule['item'], 200)) return null;
  if (!isRecord(from) || !text(from['title'], 200) || !text(from['url'], 2048)) return null;
  if (!isRecord(chain) || !text(chain['id'], 100) || !Number.isInteger(chain['hops'])) return null;
  if (!Array.isArray(chain['rules']) || !chain['rules'].every((r) => text(r, 300))) return null;
  if (!isRecord(step) || !isCrossAppKind(step['kind']) || step['kind'] === 'inbox_notice')
    return null;
  if (JSON.stringify(step).length > STEP_BYTES_MAX) return null;
  return body as unknown as AutomationStepDoorCall;
}

export async function automationStepDoor(
  request: Request,
  itemId: string,
  grants: AutomationDoorGrants,
  run: AutomationStepHandler,
): Promise<Response> {
  const call = readDoorCall(await bodyOf(request));
  if (!call) return badRequest('invalid automation step');
  const grant = request.headers.get(ITEM_GRANT_HEADER);
  const claims = await grants(grant, itemId);
  if (!grant || !grantWrites(claims, call.author, itemId))
    return json({ error: 'grant_refused' }, 403);
  try {
    return json(await run(itemId, call, claims, grant));
  } catch (err) {
    console.warn('[internal] automation step failed', { kind: call.step.kind, error: String(err) });
    return json({ ok: false, code: 'failed', reason: '' } satisfies AutomationStepAnswer);
  }
}

export async function automationTargetDoor(
  request: Request,
  itemId: string,
  grants: AutomationDoorGrants,
  run: AutomationTargetHandler,
): Promise<Response> {
  const body = await bodyOf(request);
  const author = isRecord(body) && text(body['author'], 200) ? body['author'] : null;
  if (!author) return badRequest('invalid automation target');
  const claims = await grants(request.headers.get(ITEM_GRANT_HEADER), itemId);
  if (!grantWrites(claims, author, itemId)) return json({ error: 'grant_refused' }, 403);
  try {
    return json(await run(itemId, author, claims));
  } catch (err) {
    console.warn('[internal] automation target failed', { error: String(err) });
    return json({ error: 'unavailable' }, 503);
  }
}
