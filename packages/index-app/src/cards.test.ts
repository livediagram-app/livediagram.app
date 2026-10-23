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
    assignee: assigneeId ? { hash: await hashOf(assigneeId), name: 'Bob' } : null,
    changedBy: changedById ? { hash: await hashOf(changedById), name: 'Ada' } : null,
    thread: null,
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

  it('lists every card thread, and knows its commenters and those mentioned', async () => {
    const cards = [
      await card('c1', {
        assigneeId: 'user_c',
        thread: {
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
      }),
    ];
    const { push } = await cardsCollabPush(cards, { people: [], hashOf, fallbackAssignerId: 'o' });
    expect(push.threads).toEqual([
      expect.objectContaining({
        elementId: 'c1',
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
