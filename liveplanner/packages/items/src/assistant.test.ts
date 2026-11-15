import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_CLIENT_MAX,
  assistantClientKey,
  assistantIdFor,
  assistantNameFor,
  assistantPersonOf,
  isAssistantId,
  itemAssistantFor,
  itemAssistantOf,
  normaliseAssistant,
} from './assistant';

// docs/specs/026-plan/items.md "Handing a card to an AI assistant".
const THOMAS = { id: 'a1b2c3d4e5f6a1b2c3d4e5f6', name: 'Thomas McClean', color: '#2563eb' };
const CLAUDE = itemAssistantFor(THOMAS, 'Claude')!;

describe('an AI assistant Assignee', () => {
  it('is named by its tool and its person, in its person’s colour', () => {
    expect(CLAUDE).toEqual({
      id: `ai-${THOMAS.id}-claude`,
      name: 'Claude (Thomas)',
      color: '#2563eb',
      assistant: { client: 'Claude', person: THOMAS },
    });
    expect(CLAUDE.id.length).toBeLessThanOrEqual(52);
  });

  it('is one id for one person’s tool, whatever the spacing or case of its name', () => {
    expect(assistantIdFor(THOMAS.id, '  claude ')).toBe(CLAUDE.id);
    expect(assistantIdFor(THOMAS.id, 'Cursor')).not.toBe(CLAUDE.id);
    expect(assistantIdFor('f'.repeat(24), 'Claude')).not.toBe(CLAUDE.id);
  });

  it('keeps the id inside the person kind’s 64 for a long tool name', () => {
    const id = assistantIdFor(THOMAS.id, 'A very long name for a home made agent token');
    expect(id.length).toBeLessThanOrEqual(52);
    expect(id.endsWith('-')).toBe(false);
  });

  it('hashes a tool name the slug cannot spell, so two never share an id', () => {
    const a = assistantClientKey('クロード');
    const b = assistantClientKey('ジェミニ');
    expect(a).toMatch(/^c[0-9a-z]+$/);
    expect(a).not.toBe(b);
    expect(assistantClientKey(' クロード ')).toBe(a);
  });

  it('names the tool alone when its person has no name, and cuts a long name to 80', () => {
    expect(assistantNameFor('Claude', '  ')).toBe('Claude');
    expect(assistantNameFor('C'.repeat(40), 'N'.repeat(60)).length).toBe(80);
  });

  it('makes none for a person who is not an account, or a blank or long tool name', () => {
    expect(itemAssistantFor({ ...THOMAS, id: 'n-sam' }, 'Claude')).toBeUndefined();
    expect(itemAssistantFor(THOMAS, '   ')).toBeUndefined();
    expect(itemAssistantFor(THOMAS, 'x'.repeat(ASSISTANT_CLIENT_MAX + 1))).toBeUndefined();
    expect(itemAssistantFor({ ...THOMAS, color: 'blue' }, 'Claude')).toBeUndefined();
  });

  it('hands back to the person it works for', () => {
    expect(assistantPersonOf(CLAUDE)).toEqual(THOMAS);
  });
});

describe('normaliseAssistant', () => {
  it('keeps a well formed assistant, rebuilt from its own keys', () => {
    expect(normaliseAssistant({ ...CLAUDE, extra: 1, name: ' Claude (Thomas) ' })).toEqual(CLAUDE);
  });

  it.each([
    ['a person', THOMAS],
    ['not an object', 'Claude (Thomas)'],
    ['no assistant', { id: CLAUDE.id, name: CLAUDE.name, color: CLAUDE.color }],
    ['an assistant that is not an object', { ...CLAUDE, assistant: 'Claude' }],
    ['an id another tool makes', { ...CLAUDE, id: assistantIdFor(THOMAS.id, 'Cursor') }],
    ['an id that is not an assistant’s', { ...CLAUDE, id: THOMAS.id }],
    ['an id too long', { ...CLAUDE, id: `ai-${'x'.repeat(70)}` }],
    ['a blank name', { ...CLAUDE, name: '  ' }],
    ['a long name', { ...CLAUDE, name: 'x'.repeat(81) }],
    ['a bad colour', { ...CLAUDE, color: 'red' }],
    ['a blank client', { ...CLAUDE, assistant: { ...CLAUDE.assistant, client: ' ' } }],
    ['a client that is not text', { ...CLAUDE, assistant: { ...CLAUDE.assistant, client: 3 } }],
    [
      'a person who is not an account',
      {
        ...CLAUDE,
        id: assistantIdFor('n-sam', 'Claude'),
        assistant: { client: 'Claude', person: { ...THOMAS, id: 'n-sam' } },
      },
    ],
    [
      'a person with a long name',
      { ...CLAUDE, assistant: { client: 'Claude', person: { ...THOMAS, name: 'x'.repeat(81) } } },
    ],
    [
      'a person with a bad colour',
      { ...CLAUDE, assistant: { client: 'Claude', person: { ...THOMAS, color: 'x' } } },
    ],
    ['a person that is not an object', { ...CLAUDE, assistant: { client: 'Claude', person: 1 } }],
  ])('refuses %s', (_name, value) => {
    expect(normaliseAssistant(value)).toBeUndefined();
  });
});

describe('itemAssistantOf', () => {
  it('reads the assistant a card is handed to, and none for a person or nobody', () => {
    expect(itemAssistantOf({ fields: { assignee: CLAUDE } })).toEqual(CLAUDE);
    expect(itemAssistantOf({ fields: { assignee: THOMAS } })).toBeUndefined();
    expect(itemAssistantOf({ fields: {} })).toBeUndefined();
    // One that reached the store unchecked and does not read as one is a person, never an assistant.
    expect(
      itemAssistantOf({ fields: { assignee: { ...CLAUDE, assistant: null } } }),
    ).toBeUndefined();
  });

  it('knows an assistant id by its prefix alone', () => {
    expect(isAssistantId(CLAUDE.id)).toBe(true);
    expect(isAssistantId(THOMAS.id)).toBe(false);
    expect(isAssistantId('n-ai')).toBe(false);
  });
});
