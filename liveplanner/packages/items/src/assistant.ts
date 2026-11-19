// The AI assistant Assignee (docs/specs/026-plan/items.md "Handing a card to an AI assistant"; blueprint item-store.md
// "The AI assistant Assignee"): a card handed to one person's AI tool or API token, named by the tool and its person
// ("Claude (Thomas)"). Stored in the Assignee as a person with `assistant: { client, person }` beside its id, name and
// colour, so a reader that knows nothing of assistants reads a person of that name. Never a token's id or secret.
// Pure and synchronous: the api, the offline store and the editor run the same check.

import type { Item, ItemPerson } from './item';
import { isIdentityPersonId } from './person';
import { cutSlug, slugText } from './slug';
import { HEX_COLOUR, isObj } from './validate';

export type ItemAssistant = ItemPerson & {
  assistant: { client: string; person: ItemPerson };
};

// Every assistant id starts with it; a person's never does (an account's is 24 hex, a custom assignee's `n-`).
export const ASSISTANT_ID_PREFIX = 'ai-';
// The most a tool's name holds, as the token names it ("Claude", "CI bot").
export const ASSISTANT_CLIENT_MAX = 40;
// The longest client slug an id carries: `ai-` + 24 hex + `-` + 24 is 52, inside the person kind's 64.
export const ASSISTANT_CLIENT_SLUG_MAX = 24;
// A person's name and id, as the person kind bounds them (fields.ts).
const NAME_MAX = 80;
const ID_MAX = 64;

// Whether an id is an assistant's. Read alone, it keeps a value from ever being notified, well formed or not.
export const isAssistantId = (id: string): boolean => id.startsWith(ASSISTANT_ID_PREFIX);

// The client's part of an assistant id: its slug, or `c` and a hash of the name when the slug cannot spell it.
export function assistantClientKey(client: string): string {
  const trimmed = client.trim();
  const slug = cutSlug(slugText(trimmed), ASSISTANT_CLIENT_SLUG_MAX);
  if (slug) return slug;
  let h = 0x811c9dc5;
  for (const ch of trimmed) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return `c${h.toString(36)}`;
}

// One person's tool is one id on every card of every plan.
export const assistantIdFor = (personId: string, client: string): string =>
  `${ASSISTANT_ID_PREFIX}${personId}-${assistantClientKey(client)}`;

// "Claude (Thomas)": the tool, then its person's first name; the tool alone when the person has no name.
export function assistantNameFor(client: string, personName: string): string {
  const tool = client.trim();
  const first = personName.trim().split(/\s/, 1)[0]!;
  return (first ? `${tool} (${first})` : tool).slice(0, NAME_MAX);
}

const clientOf = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 && t.length <= ASSISTANT_CLIENT_MAX ? t : undefined;
};

// A person an assistant works for: the person kind's shape, and a liveworkspace identity (a token is an account's).
function identityOf(v: unknown): ItemPerson | undefined {
  if (!isObj(v)) return undefined;
  const { id, name, color } = v;
  if (typeof id !== 'string' || !isIdentityPersonId(id)) return undefined;
  if (typeof name !== 'string' || name.length > NAME_MAX) return undefined;
  if (typeof color !== 'string' || !HEX_COLOUR.test(color)) return undefined;
  return { id, name: name.trim(), color };
}

// The Assignee a hand-over writes: the person's tool, in the person's colour. Undefined for a person who is not an
// identity, or a blank or long client.
export function itemAssistantFor(person: ItemPerson, client: string): ItemAssistant | undefined {
  const owner = identityOf(person);
  const tool = clientOf(client);
  if (!owner || !tool) return undefined;
  return {
    id: assistantIdFor(owner.id, tool),
    name: assistantNameFor(tool, owner.name),
    color: owner.color,
    assistant: { client: tool, person: owner },
  };
}

// An assistant checked whole and rebuilt from its own keys, or undefined: the id must be the one its client and person
// make, so no value names one person's tool under another's id.
export function normaliseAssistant(v: unknown): ItemAssistant | undefined {
  if (!isObj(v)) return undefined;
  const { id, name, color, assistant } = v;
  if (typeof id !== 'string' || id.length > ID_MAX || !isAssistantId(id)) return undefined;
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > NAME_MAX)
    return undefined;
  if (typeof color !== 'string' || !HEX_COLOUR.test(color)) return undefined;
  if (!isObj(assistant)) return undefined;
  const client = clientOf(assistant['client']);
  const person = identityOf(assistant['person']);
  if (!client || !person || id !== assistantIdFor(person.id, client)) return undefined;
  return { id, name: name.trim(), color, assistant: { client, person } };
}

// The assistant a card is handed to, read with the same check a write passes: a person, or a value that does not read
// as an assistant, is none.
export const itemAssistantOf = (item: Pick<Item, 'fields'>): ItemAssistant | undefined =>
  normaliseAssistant(item.fields['assignee']);

// The person a hand-back assigns: the one the assistant works for.
export const assistantPersonOf = (assistant: ItemAssistant): ItemPerson => ({
  ...assistant.assistant.person,
});

// Who hands back the cards of an assistant whose token was revoked (docs/specs/026-plan/items.md "When its token is
// revoked"): a system author, as Repeat is, so the card's history notes why and no person is named as having done it.
export const REVOKED_PERSON: ItemPerson = {
  id: 'access-revoked',
  name: 'Access Revoked',
  color: '#64748b',
};
