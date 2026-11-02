import { describe, expect, it } from 'vitest';
import { tabStatsOf } from './tab-stats';

// docs/specs/013-workspace/explorer-details-view.md "Where the numbers come from".

const thread = (n: number, resolved = false) => ({
  resolved,
  comments: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, text: 'hi' })),
});

describe('tabStatsOf', () => {
  it('counts elements, every comment and the stored bytes, in Workshop', () => {
    const body = {
      opensIn: 'draw',
      elements: [
        { id: 'a', type: 'shape', commentThread: thread(2) },
        { id: 'b', type: 'shape', commentThread: thread(1, true) },
        { id: 'c', type: 'shape' },
      ],
    };
    const data = JSON.stringify(body);
    expect(tabStatsOf(body, data)).toEqual({
      mode: 'workshop',
      elementCount: 3,
      commentCount: 3,
      dataBytes: new TextEncoder().encode(data).length,
    });
  });

  it('measures bytes, not characters', () => {
    const data = JSON.stringify({ elements: [], note: 'héé' });
    expect(tabStatsOf({ elements: [] }, data).dataBytes).toBe(data.length + 2);
  });

  it('reads Workshop for a tab with no mode, an event-storming board and every legacy mode', () => {
    expect(tabStatsOf({ elements: [] }, '{}').mode).toBe('workshop');
    expect(tabStatsOf({ kind: 'event-storming', opensIn: 'draw', elements: [] }, '{}').mode).toBe(
      'workshop',
    );
    expect(tabStatsOf({ opensIn: 'diagram', elements: [] }, '{}').mode).toBe('workshop');
    expect(tabStatsOf({ opensIn: 'pages', elements: [] }, '{}').mode).toBe('workshop');
  });

  it('counts a body without an elements array as empty', () => {
    expect(tabStatsOf({}, '{}')).toMatchObject({ elementCount: 0, commentCount: 0 });
  });
});
