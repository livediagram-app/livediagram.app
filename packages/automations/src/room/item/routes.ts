// An item's Automations routes, `…/automations[/…]` (liveworkspace/docs/specs/018-automations/automations.md "Who may
// do what"; blueprint item-engine.md "Routes"): one function an app calls from its sub-resource chain, with the
// caller it resolved. Every route but a rule's read-only summary is an Editor's of the whole item, signed in, in
// person or through their API token (a read-only token lists and reads the Audit Trail, nothing else): anyone else
// is answered 403 `automations_need_editor`.
import type { ItemRule } from '../../item';
import { draftRule } from './routes-draft';
import {
  createRule,
  duplicateRule,
  listRules,
  orderRules,
  removeRule,
  saveRule,
  toggleRule,
} from './routes-rules';
import { listItemRuns, makeSecret, ruleSummaryRoute, runRuleNow, testRule } from './routes-runs';
import { json, notFoundRule, refuse, type Gated, type ItemRoutesInput } from './route-kit';

export type { ItemCaller, ItemListedRule, ItemRoutesInput } from './route-kit';

type Door = (g: Gated) => Response | Promise<Response>;
type RuleDoor = (g: Gated, held: ItemRule) => Promise<Response>;

const methodNotAllowed = (): Response => json({ error: 'method_not_allowed' }, 405);

// The door a path and method name, before anything is read: null for no such path, 'method' for a verb it lacks.
function doorOf(input: ItemRoutesInput): Door | 'method' | null {
  const { segments, method } = input;
  const on = (verb: string, door: Door): Door | 'method' => (method === verb ? door : 'method');
  const ofRule =
    (door: RuleDoor): Door =>
    (g) => {
      const held = g.deps.store.get(segments[0]!);
      return held ? door(g, held) : notFoundRule();
    };
  if (segments.length === 0) return method === 'GET' ? listRules : on('POST', createRule);
  if (segments.length === 1) {
    if (segments[0] === 'order') return on('POST', orderRules);
    if (segments[0] === 'test') return on('POST', testRule);
    if (segments[0] === 'draft') return on('POST', draftRule);
    if (segments[0] === 'runs') return on('GET', listItemRuns);
    return method === 'PUT' ? ofRule(saveRule) : on('DELETE', ofRule(removeRule));
  }
  if (segments.length !== 2) return null;
  if (segments[1] === 'toggle') return on('POST', ofRule(toggleRule));
  if (segments[1] === 'duplicate') return on('POST', ofRule(duplicateRule));
  if (segments[1] === 'run') return on('POST', ofRule(runRuleNow));
  if (segments[1] === 'secret') return on('POST', ofRule(makeSecret));
  return null;
}

// The door every route but the summary passes.
function gate(input: ItemRoutesInput): Gated | Response {
  const { caller } = input;
  if (caller.token?.readOnly && input.method !== 'GET') {
    console.info('[automations] refused', { token: true, readOnly: true });
    return json({ error: 'read_only_token' }, 403);
  }
  const deps = input.engine.deps();
  if (!caller.signedIn || !caller.editor || !deps) {
    console.info('[automations] refused', { token: !!caller.token, signedIn: caller.signedIn });
    return refuse(403, 'automations_need_editor');
  }
  return { ...input, deps, ai: !!caller.token };
}

/** `…/automations[/…]` answered, or null for a path that is none of its routes. A rule's summary is a reader's, so
 *  it is answered before the Editor's gate. */
export async function handleItemAutomationRoutes(input: ItemRoutesInput): Promise<Response | null> {
  if (input.segments.length === 1 && input.segments[0] === 'summary')
    return input.method === 'GET' ? ruleSummaryRoute(input) : methodNotAllowed();
  const door = doorOf(input);
  if (door === null) return null;
  if (door === 'method') return methodNotAllowed();
  const g = gate(input);
  return g instanceof Response ? g : door(g);
}
