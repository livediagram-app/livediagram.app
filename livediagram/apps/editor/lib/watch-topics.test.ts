import { describe, expect, it, vi } from 'vitest';

// Which Watch It Built topics a person has taken (docs/specs/007-editor/watch-it-built.md "The start panel").
vi.mock('@/lib/replay/curriculum', () => ({
  CURRICULUM: {
    diagram: [{ id: 'diagram-basics' }, { id: 'diagram-look' }],
    draw: [{ id: 'draw-sketch' }],
    workshop: [],
  },
}));
const { markTopicTaken, offerTopicAgain, setModeTopics, topicsOwed, topicTaken } =
  await import('./watch-topics');

describe('watch topics', () => {
  it('counts the older tourSeen as The Basics taken, and nothing else', () => {
    expect(topicTaken({ tourSeen: true }, 'diagram-basics')).toBe(true);
    expect(topicTaken({ tourSeen: true }, 'diagram-look')).toBe(false);
    expect(topicTaken({ drawTourSeen: true }, 'draw-sketch')).toBe(false);
    expect(topicTaken(null, 'diagram-basics')).toBe(false);
  });

  it('owes a mode its untaken topics, and records a pick once', () => {
    const once = markTopicTaken({}, 'diagram-look');
    expect(markTopicTaken(once, 'diagram-look').watchTopics).toEqual(['diagram-look']);
    expect(topicsOwed(once, 'diagram').map((t) => t.id)).toEqual(['diagram-basics']);
    expect(topicsOwed(once, 'workshop')).toEqual([]);
  });

  it('offers a topic again, clearing the older flag for The Basics', () => {
    const prefs = { tourSeen: true, watchTopics: ['diagram-basics', 'diagram-look'] };
    expect(offerTopicAgain(prefs, 'diagram-basics')).toEqual({
      tourSeen: false,
      watchTopics: ['diagram-look'],
    });
    expect(offerTopicAgain({}, 'diagram-look')).toEqual({ watchTopics: [] });
  });

  it('takes or offers a whole mode at once, leaving the others alone', () => {
    const taken = setModeTopics({ watchTopics: ['draw-sketch'] }, 'diagram', true);
    expect(topicsOwed(taken, 'diagram')).toEqual([]);
    const again = setModeTopics({ ...taken, tourSeen: true }, 'diagram', false);
    expect(topicsOwed(again, 'diagram')).toHaveLength(2);
    expect(again.watchTopics).toEqual(['draw-sketch']);
  });
});
