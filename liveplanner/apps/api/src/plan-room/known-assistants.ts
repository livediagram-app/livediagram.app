// The AI assistants a plan remembers (docs/specs/026-plan/items.md "Handing a card to an AI assistant", "Who it can be
// handed to"; blueprint item-store.md "Assistants the plan remembers"): each token's tool and person, noted the first
// time it reaches the plan's cards with the right to change them, so the Assignee picker can offer it. Never the token.

import { itemAssistantFor, type ItemAssistant, type ItemPerson } from '@liveplanner/items';
import type { PlanEnv } from '../types';

// The most a plan remembers; the oldest go first.
export const KNOWN_ASSISTANTS_MAX = 50;
// How often one assistant's row is written again (its name and colour refreshed): at most once an hour, so a token
// listing the plan's cards again and again writes nothing.
export const KNOWN_ASSISTANT_REFRESH_MS = 60 * 60 * 1000;

// The plan schema's step V39 (plan-schema.ts). IF NOT EXISTS, so running it again changes nothing.
export const KNOWN_ASSISTANTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS known_assistants (
  id        TEXT    PRIMARY KEY,
  client    TEXT    NOT NULL,
  person_id TEXT    NOT NULL,
  person    TEXT    NOT NULL,
  seen_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS known_assistants_seen ON known_assistants (seen_at);
`;

// A token's assistant as it stands, from its name and its person (writer's), or undefined for a token that names no
// tool the store takes.
export const tokenAssistant = (
  person: { id: string; name: string; color: string },
  tokenName: string,
): ItemAssistant | undefined => itemAssistantFor(person, tokenName);

// Whether this assistant's row was written within the refresh window.
export async function seenLately(env: PlanEnv, id: string, now: number): Promise<boolean> {
  const row = await env.PLAN_DB.prepare('SELECT seen_at FROM known_assistants WHERE id = ?')
    .bind(id)
    .first<{ seen_at: number }>();
  return !!row && now - row.seen_at < KNOWN_ASSISTANT_REFRESH_MS;
}

// Writes (or refreshes) one assistant and keeps the newest KNOWN_ASSISTANTS_MAX, in one batch.
export async function rememberAssistant(
  env: PlanEnv,
  assistant: ItemAssistant,
  now: number,
): Promise<void> {
  const { client, person } = assistant.assistant;
  await env.PLAN_DB.batch([
    env.PLAN_DB.prepare(
      `INSERT INTO known_assistants (id, client, person_id, person, seen_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET client = excluded.client, person = excluded.person,
         seen_at = excluded.seen_at`,
    ).bind(assistant.id, client, person.id, JSON.stringify(person), now),
    env.PLAN_DB.prepare(
      `DELETE FROM known_assistants WHERE id NOT IN
         (SELECT id FROM known_assistants ORDER BY seen_at DESC LIMIT ?)`,
    ).bind(KNOWN_ASSISTANTS_MAX),
  ]);
}

// Every remembered assistant, newest first, each read back through the write's own check (a row that fails it is
// left out).
export async function knownAssistants(env: PlanEnv): Promise<ItemAssistant[]> {
  const { results } = await env.PLAN_DB.prepare(
    'SELECT client, person FROM known_assistants ORDER BY seen_at DESC',
  ).all<{ client: string; person: string }>();
  const out: ItemAssistant[] = [];
  for (const row of results) {
    let person: unknown;
    try {
      person = JSON.parse(row.person);
    } catch {
      continue;
    }
    // itemAssistantFor checks the person whole (an identity, a name, a colour) and the client.
    const made = itemAssistantFor(person as ItemPerson, row.client);
    if (made) out.push(made);
  }
  return out;
}

// A closed account's assistants (plan-anonymise.ts), by its hashed person id: forgotten with its name.
export const FORGET_ASSISTANTS_SQL = 'DELETE FROM known_assistants WHERE person_id = ?';
