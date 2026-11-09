import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { isCollabKey } from '@liveworkspace/api-schema/collab-key';
import { sha256Hex } from '@liveworkspace/api-schema/sha256';
import {
  COLLAB_KEY_HEADER,
  collabKeyFor,
  mintCollabKey,
  namesAnotherPerson,
  REACTION_PERSON_HEADER,
  reactionPersonFor,
  sessionCollabKey,
  sessionReactionPerson,
} from './collab-key';

const KEY = '0123456789abcdef0123456789abcdef';
const OTHER = 'fedcba9876543210fedcba9876543210';

describe('collabKeyFor', () => {
  it('is the first 32 hex of SHA-256 of the versioned label and the id', async () => {
    const full = await sha256Hex(new TextEncoder().encode('liveworkspace:collab:v1:user_abc'));
    expect(await collabKeyFor('user_abc')).toBe(full.slice(0, 32));
  });

  it('is the same for one person every time, and differs between people', async () => {
    const a = await collabKeyFor('guest_1');
    expect(isCollabKey(a)).toBe(true);
    expect(await collabKeyFor('guest_1')).toBe(a);
    expect(await collabKeyFor('guest_2')).not.toBe(a);
  });

  it('names its header', () => {
    expect(COLLAB_KEY_HEADER).toBe('X-Verified-Collab-Key');
  });
});

describe('sessionCollabKey', () => {
  it('keeps a header of the right shape', () => {
    expect(sessionCollabKey(KEY)).toBe(KEY);
  });

  it('mints a fresh key for an empty, missing or malformed header', () => {
    for (const header of [null, undefined, '', 'not-a-key', KEY.toUpperCase()]) {
      const key = sessionCollabKey(header);
      expect(isCollabKey(key)).toBe(true);
      expect(key).not.toBe(KEY);
    }
  });

  it('mints a different key each time', () => {
    expect(mintCollabKey()).not.toBe(mintCollabKey());
  });
});

describe('namesAnotherPerson', () => {
  const vote = (voter: unknown) => ({ kind: 'vote', tabId: 't', elementId: 'e', voter, delta: 1 });
  const response = (participantId: unknown) => ({
    kind: 'el-delta',
    tabId: 't',
    elementId: 'e',
    delta: { kind: 'response', participantId, value: '1', at: 1 },
  });

  it('passes a dot or a response under the sender key', () => {
    expect(namesAnotherPerson(vote(KEY), KEY)).toBe(false);
    expect(namesAnotherPerson(response(KEY), KEY)).toBe(false);
  });

  it('flags a dot or a response under another key, or from a sender with none', () => {
    expect(namesAnotherPerson(vote(OTHER), KEY)).toBe(true);
    expect(namesAnotherPerson(response(OTHER), KEY)).toBe(true);
    expect(namesAnotherPerson(vote(KEY), undefined)).toBe(true);
    expect(namesAnotherPerson(response(KEY), undefined)).toBe(true);
    expect(namesAnotherPerson(response(undefined), KEY)).toBe(true);
  });

  it('leaves every other op alone', () => {
    expect(namesAnotherPerson(null, KEY)).toBe(false);
    expect(namesAnotherPerson('vote', KEY)).toBe(false);
    expect(namesAnotherPerson({ kind: 'cursor' }, KEY)).toBe(false);
    expect(namesAnotherPerson({ kind: 'el-delta', delta: null }, KEY)).toBe(false);
    expect(namesAnotherPerson({ kind: 'el-delta' }, undefined)).toBe(false);
    const react = { kind: 'el-delta', delta: { kind: 'comment-react', by: OTHER } };
    expect(namesAnotherPerson(react, KEY)).toBe(false);
    expect(namesAnotherPerson({ kind: 'el-delta', delta: { kind: 'idea' } }, undefined)).toBe(
      false,
    );
  });

  // The relay's hot path: every op a socket sends passes this check. It reads two fields, so a frame's size does not
  // matter; 100 000 checks stay well inside a millisecond each.
  it('costs next to nothing per op', () => {
    const ops = [vote(KEY), response(OTHER), { kind: 'cursor', x: 1, y: 2 }, response(KEY)];
    const cpu = cpuMsOf(() => {
      for (let i = 0; i < 100_000; i++) namesAnotherPerson(ops[i % ops.length], KEY);
    });
    expect(cpu).toBeLessThan(cpuBudgetMs(50));
  });
});

// docs/specs/012-collaboration/comment-reactions.md: the person the room stamps on a reaction.
describe('reactionPersonFor', () => {
  it("is liveplanner's itemPersonId: the first 24 hex of SHA-256 of its label and the id", async () => {
    const full = await sha256Hex(new TextEncoder().encode('liveplanner-item-person:user_abc'));
    expect(await reactionPersonFor('user_abc')).toBe(full.slice(0, 24));
    expect(await reactionPersonFor('user_abc')).not.toBe(await reactionPersonFor('user_abd'));
  });

  it('is kept from the header only in its shape', async () => {
    const person = await reactionPersonFor('guest_1');
    expect(sessionReactionPerson(person)).toBe(person);
    for (const header of [null, undefined, '', 'x'.repeat(24), person.toUpperCase(), KEY])
      expect(sessionReactionPerson(header)).toBeNull();
    expect(REACTION_PERSON_HEADER).toBe('X-Verified-Reaction-Person');
  });
});
