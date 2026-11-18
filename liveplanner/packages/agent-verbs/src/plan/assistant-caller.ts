// The AI assistant calling (docs/specs/026-plan/plan-agents.md "Cards handed to an assistant"): its token's name as the
// tool and its account as the person, so a card handed to "me" names the same assistant the editor's picker offers.
// Read only by the calls that need it (list_items' handedToMe, an assignee of "me", hand_back), once each.
import { ApiError, type ApiClient } from '@liveworkspace/api-client';
import type { CurrentTokenResponse } from '@liveplanner/api-schema';
import {
  assignedPeople,
  itemAssistantFor,
  itemPersonId,
  personNamed,
  type Item,
  type ItemAssistant,
  type ItemPerson,
} from '@liveplanner/items';

export type AssistantRefusal = { ok: false; code: 'not_an_assistant'; message: string };

export const NOT_AN_ASSISTANT =
  'Only an AI tool or API token can be handed cards, and this one has no name to be known by: connect the AI tool ' +
  '(its token is named after it) or give the token a name, then try again.';

const refusal: AssistantRefusal = {
  ok: false,
  code: 'not_an_assistant',
  message: NOT_AN_ASSISTANT,
};

// The person a token works for, as the plan's cards already show them (a card made or last edited by them, the stamp
// the api writes for every write), else their account's name in a Plan swatch, as a new name would get.
function personFor(id: string, accountName: string | null, items: readonly Item[]): ItemPerson {
  for (const i of items) {
    if (i.createdBy?.id === id) return { ...i.createdBy };
    if (i.updatedBy?.id === id) return { ...i.updatedBy };
  }
  const name = accountName?.trim() || 'Someone';
  return { ...personNamed(name, assignedPeople(items)), id, name };
}

export async function callerAssistant(
  api: ApiClient,
  items: readonly Item[],
): Promise<({ ok: true } & { assistant: ItemAssistant }) | AssistantRefusal> {
  let current: CurrentTokenResponse;
  try {
    current = await api.json<CurrentTokenResponse>('/tokens/current');
  } catch (err) {
    // A signed-in session or a guest is not a token: it has no assistant.
    if (err instanceof ApiError && err.status === 403) return refusal;
    throw err;
  }
  const person = personFor(await itemPersonId(current.accountId), current.accountName, items);
  const assistant = itemAssistantFor(person, current.tokenName ?? '');
  return assistant ? { ok: true, assistant } : refusal;
}

// The caller's assistant, read the first time a call asks for it and kept for the rest of that call.
export function assistantOnce(
  api: ApiClient,
  items: () => readonly Item[],
): () => ReturnType<typeof callerAssistant> {
  let read: ReturnType<typeof callerAssistant> | undefined;
  return () => (read ??= callerAssistant(api, items()));
}

// list_items' and `item ls`' handedToMe: the calling assistant's id to keep the cards of, none when not asked, or the
// refusal of a caller that is no assistant.
export async function handedToOf(
  api: ApiClient,
  items: readonly Item[],
  handedToMe: boolean | undefined,
): Promise<{ ok: true; handedTo?: string } | AssistantRefusal> {
  if (!handedToMe) return { ok: true };
  const read = await callerAssistant(api, items);
  return read.ok ? { ok: true, handedTo: read.assistant.id } : read;
}
