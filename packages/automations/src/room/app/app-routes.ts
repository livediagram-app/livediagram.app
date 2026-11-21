// An app's `…/<items>/:id/automations[/…]` routes (blueprint item-engine.md "Routes", "An app's bindings"). The
// routes themselves are the engine's (item/routes.ts); an app's route file names the path by its own literal
// segments, says who is calling by its own gates, and hands both here.
import type { AutomationPerson } from '../../types';
import type { ItemEngine } from '../item/engine';
import { json, type ItemCaller } from '../item/route-kit';
import { handleItemAutomationRoutes } from '../item/routes';
import { SOMEONE } from './host';

// The second part of the two-part paths the engine serves.
const VERBS: ReadonlySet<string> = new Set(['toggle', 'duplicate', 'run', 'secret']);

/** The path after `…/automations` when it is a shape the engine serves ([], [a], [a, verb]); null for any other, so
 *  an app touches nothing for it. */
export function itemAutomationPath(rest: readonly (string | undefined)[]): string[] | null {
  const parts = rest.filter((part): part is string => part !== undefined);
  if (parts.length > 2) return null;
  if (parts.length === 2 && !VERBS.has(parts[1]!)) return null;
  return parts;
}

// Who is calling, as the app's gates found them.
export interface ItemCallerFacts {
  // An Editor of the whole item: never through a link confined to one tab, never an embed.
  editor: boolean;
  // An account, in person or behind a token: a guest's id is never one.
  signedIn: boolean;
  token: { readOnly?: boolean } | null | undefined;
  // The caller's id, as the app names them; null for a visitor with none.
  callerId: string | null;
  // The caller as their rules and runs name them: asked only for someone the gate lets through.
  person: () => Promise<AutomationPerson>;
  // Holds any grant on the item, for a rule's summary.
  reader: boolean;
}

/** The engine's caller. Anyone but a signed-in Editor is "Someone" (never stored: they are refused). */
export async function itemCallerOf(facts: ItemCallerFacts): Promise<ItemCaller> {
  return {
    editor: facts.editor,
    signedIn: facts.signedIn,
    ...(facts.token ? { token: { readOnly: facts.token.readOnly === true } } : {}),
    person:
      facts.editor && facts.signedIn && facts.callerId !== null
        ? await facts.person()
        : { ...SOMEONE, id: facts.callerId ?? '' },
    reader: facts.reader,
  };
}

/** The engine's answer for the path, or 503 `automations_unavailable` outside an item's room. Null for a path the
 *  engine does not serve. */
export async function serveItemAutomations(input: {
  engine: ItemEngine | undefined;
  request: Request;
  url: URL;
  rest: readonly string[];
  caller: () => Promise<ItemCaller>;
}): Promise<Response | null> {
  if (!input.engine) return json({ error: 'automations_unavailable' }, 503);
  return handleItemAutomationRoutes({
    engine: input.engine,
    method: input.request.method,
    segments: input.rest,
    request: input.request,
    url: input.url,
    caller: await input.caller(),
  });
}
