import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { migrateDocumentSchema } from '../document-room/document-schema';
import {
  savedBy,
  acceptedSuggestionWriter,
  guestOwnersOf,
  guestStampNamer,
  pageAuthorKindsSchemaStep,
  stampOf,
  writerOf,
} from './page-writer';

// docs/specs/030-knowledgebase/verification.md "Made by a person or an agent".
const request = (headers: Record<string, string> = {}) =>
  new Request('https://api.test/x', { headers });

describe('the writer of a request', () => {
  it('is the person without a token', () => {
    expect(writerOf({ token: null, request: request() }, 'user_a')).toEqual({
      by: 'user_a',
      kind: 'human',
    });
  });

  it('is an agent with one, named by its client, else its token, with the door it came through', () => {
    const token = { name: 'Release bot' };
    expect(
      writerOf(
        {
          token,
          request: request({ 'X-Liveknowledge-Client': 'mcp', 'X-Liveknowledge-Agent': 'Claude' }),
        },
        'user_a',
      ),
    ).toEqual({ by: 'user_a', kind: 'ai', agent: 'Claude', via: 'mcp' });
    expect(
      writerOf({ token, request: request({ 'X-Liveknowledge-Client': 'cli' }) }, 'user_a'),
    ).toEqual({
      by: 'user_a',
      kind: 'ai',
      agent: 'Release bot',
      via: 'cli',
    });
    // A plain API caller, and one that says it is the editor: the API either way. A token with no name is unnamed.
    for (const client of [undefined, 'editor'])
      expect(
        writerOf(
          { token: {}, request: request(client ? { 'X-Liveknowledge-Client': client } : {}) },
          'u',
        ),
      ).toEqual({ by: 'u', kind: 'ai', agent: null, via: 'api' });
    expect(
      writerOf({ token: { name: 'x'.repeat(200) }, request: request() }, 'u').agent,
    ).toHaveLength(80);
  });

  it('is the agent, through a suggestion, when a person accepts its edit', () => {
    expect(acceptedSuggestionWriter('user_e', ' Claude ')).toEqual({
      by: 'user_e',
      kind: 'ai',
      agent: 'Claude',
      via: 'suggestion',
    });
    expect(acceptedSuggestionWriter('user_e', '').agent).toBeNull();
  });

  it('reads an unknown kind as a person’s and an unknown door as none', () => {
    expect(stampOf('u', 1, 'robot', '', 'telepathy')).toEqual({ by: 'u', at: 1, kind: 'human' });
    expect(stampOf('u', 1, 'ai', 'Claude', 'mcp')).toEqual({
      by: 'u',
      at: 1,
      kind: 'ai',
      agent: 'Claude',
      via: 'mcp',
    });
  });
});

describe('schema step V18', () => {
  it('adds the kinds to a room at V17, its rows reading as people’s, and runs again harmlessly', () => {
    const raw = new DatabaseSync(':memory:');
    const sql = nodeItemSql(raw);
    const exec = (q: string) => sql.exec(q);
    migrateDocumentSchema(exec);
    // A room V17 left: page_authors without the kinds, a row in it, its version 17.
    for (const c of [
      'created_kind',
      'created_agent',
      'created_via',
      'updated_kind',
      'updated_agent',
      'updated_via',
    ])
      raw.exec(`ALTER TABLE page_authors DROP COLUMN ${c}`);
    raw.exec("INSERT INTO page_authors VALUES ('t1', 'user_a', 1, 'user_b', 2)");
    raw.exec('UPDATE _document_schema SET version = 17');
    migrateDocumentSchema(exec);
    expect(raw.prepare('SELECT * FROM page_authors').get()).toMatchObject({
      created_by: 'user_a',
      created_kind: 'human',
      created_agent: null,
      updated_kind: 'human',
      updated_via: null,
    });
    // Asked before each ALTER: a second run, or a room that already had some, adds nothing twice.
    expect(() => pageAuthorKindsSchemaStep(exec)).not.toThrow();
  });
});

describe('a guest on a stamp, as it leaves the api', () => {
  const names = new Map([['guest_abc', 'Bright Marlin']]);
  const named = guestStampNamer((id) => names.get(id));
  it('names a guest from their profile and never sends their owner id', () => {
    expect(named({ by: 'guest_abc', at: 1 })).toEqual({ by: 'guest:Bright Marlin (Guest)', at: 1 });
    expect(named({ by: 'guest_zzz', at: 1 }).by).toBe('guest');
  });
  it('passes an account’s stamp and one already naming a guest as they are', () => {
    expect(named({ by: 'user_1', at: 1 }).by).toBe('user_1');
    expect(named({ by: 'guest:Sam (Guest)', at: 1 }).by).toBe('guest:Sam (Guest)');
    expect(guestOwnersOf([{ by: 'guest_abc' }, { by: 'guest_abc' }, { by: 'user_1' }])).toEqual([
      'guest_abc',
    ]);
  });
});

describe('savedBy', () => {
  it('stamps a guest by the name they edit under, never their id', () => {
    expect(savedBy('guest_7cf30592', 'Bright Marlin')).toBe('guest:Bright Marlin (Guest)');
  });
  it('keeps a guest with no name, an account and a stamp already naming a guest as they are', () => {
    expect(savedBy('guest_7cf30592', '')).toBe('guest_7cf30592');
    expect(savedBy('guest_7cf30592', 'Guest')).toBe('guest_7cf30592');
    expect(savedBy('user_abc', 'Roger')).toBe('user_abc');
  });
});
