import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cardsCollabPush, type InboxCardSource } from './cards';

const hashOf = async (id: string) =>
  createHash('sha256').update(`h:${id}`).digest('hex').slice(0, 24);

const card = async (
  id: string,
  patch: Partial<InboxCardSource> & { assigneeId?: string; changedById?: string } = {},
): Promise<InboxCardSource> => {
  const { assigneeId, changedById, ...rest } = patch;
  return {
    id,
    card: { key: 1, type: 'task', typeLabel: 'Task', title: `Card ${id}`, board: null },
    teamId: null,
    createdAt: 1,
    updatedAt: 2,
    assignees: assigneeId ? [{ hash: await hashOf(assigneeId), name: 'Bob', actionId: id }] : [],
    changedBy: changedById ? { hash: await hashOf(changedById), name: 'Ada' } : null,
    threads: [],
    ...rest,
  };
};

describe('cardsCollabPush', () => {
  it('names a card’s assignee by matching their hash against the people the item knows', async () => {
    const cards = [
      await card('c1', { assigneeId: 'user_b', changedById: 'user_a' }),
      await card('c2', { assigneeId: 'user_stranger' }),
      await card('c3'),
    ];
    const { push, unmatched } = await cardsCollabPush(cards, {
      people: ['user_a', 'user_b'],
      hashOf,
      fallbackAssignerId: 'user_owner',
    });
    expect(push.actions).toEqual([
      expect.objectContaining({
        elementId: 'c1',
        actionId: 'c1',
        name: 'Card c1',
        assigneeId: 'user_b',
        assignerId: 'user_a',
        card: cards[0]!.card,
      }),
    ]);
    expect(unmatched).toBe(1);
  });

  it('pushes one action a person a card tells, each under its own action id, a person once', async () => {
    const tell = async (personId: string, actionId: string) => ({
      hash: await hashOf(personId),
      name: personId,
      actionId,
    });
    const cards = [
      await card('c1', {
        assignees: [
          await tell('user_b', 'c1'),
          await tell('user_c', 'c1~f-reviewer'),
          await tell('user_stranger', 'c1~f-qa'),
          await tell('user_b', 'c1~f-owner'),
        ],
      }),
    ];
    const { push, unmatched } = await cardsCollabPush(cards, {
      people: ['user_b', 'user_c'],
      hashOf,
      fallbackAssignerId: 'o',
    });
    expect(
      push.actions.map((a) => [a.elementId, a.actionId, a.assigneeId, a.assigneeName]),
    ).toEqual([
      ['c1', 'c1', 'user_b', 'user_b'],
      ['c1', 'c1~f-reviewer', 'user_c', 'user_c'],
    ]);
    expect(unmatched).toBe(1);
  });

  it('lists every card thread, and knows its commenters and those mentioned', async () => {
    const cards = [
      await card('c1', {
        assigneeId: 'user_c',
        threads: [
          {
            id: 'th-1',
            title: 'Ada: hi',
            resolved: false,
            comments: [
              {
                authorId: 'user_a',
                authorName: 'Ada',
                authorColor: '#f00',
                text: 'hi',
                createdAt: 5,
              },
              {
                authorId: 'user_b',
                authorName: 'Bob',
                authorColor: '#0f0',
                text: 'ping @Cat',
                createdAt: 9,
                mentionIds: ['user_c'],
              },
            ],
          },
        ],
      }),
    ];
    const { push } = await cardsCollabPush(cards, { people: [], hashOf, fallbackAssignerId: 'o' });
    expect(push.threads).toEqual([
      expect.objectContaining({
        elementId: 'th-1',
        elementLabel: 'Ada: hi',
        card: { ...cards[0]!.card, id: 'c1' },
        commentCount: 2,
        participantIds: ['user_a', 'user_b'],
        mentionedIds: ['user_c'],
        latestText: 'ping @Cat',
        firstAt: 5,
        latestAt: 9,
      }),
    ]);
    // Mentioned, so known: the card's assignee is matched, the owner named as assigner.
    expect(push.actions.map((a) => [a.assigneeId, a.assignerId])).toEqual([['user_c', 'o']]);
  });

  it('lists each thread once, on the first card naming it, and skips one with no comments', async () => {
    const comment = { authorName: 'Ada', authorColor: '#f00', text: 'hi', createdAt: 5 };
    const shared = { id: 'th-s', title: 'Shared', resolved: false, comments: [comment] };
    const cards = [
      await card('c1', { threads: [shared, { ...shared, id: 'th-e', comments: [] }] }),
      await card('c2', { threads: [shared, { ...shared, id: 'th-2', title: 'Own' }] }),
    ];
    const { push } = await cardsCollabPush(cards, { people: [], hashOf, fallbackAssignerId: 'o' });
    expect(push.threads.map((t) => [t.elementId, t.card?.id])).toEqual([
      ['th-s', 'c1'],
      ['th-2', 'c2'],
    ]);
  });

  it('pushes 2,000 cards among 200 people within budget, capped as the index caps one push', async () => {
    const people = Array.from({ length: 200 }, (_, i) => `user_${i}`);
    const cards = await Promise.all(
      Array.from({ length: 2_000 }, (_, i) =>
        card(`c${i}`, { assigneeId: people[i % 200]!, updatedAt: i }),
      ),
    );
    const start = performance.now();
    const { push } = await cardsCollabPush(cards, { people, hashOf, fallbackAssignerId: 'o' });
    const took = performance.now() - start;
    expect(took).toBeLessThan(200);
    expect(push.actions).toHaveLength(500);
    expect(push.actions[0]!.updatedAt).toBe(1_999);
  });
});
