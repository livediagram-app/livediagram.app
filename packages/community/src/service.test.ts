import { COMMUNITY_STATES_MAX, ITEM_COMMUNITY_STATES } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { COMMUNITY_DOCUMENT_STATES, COMMUNITY_SWEEP_BATCH } from './service';

describe('the sweep contract', () => {
  it('takes as many posts a run as the index answers at once', () => {
    expect(COMMUNITY_SWEEP_BATCH).toBe(COMMUNITY_STATES_MAX);
  });

  it('names every document state the index answers, plus gone', () => {
    expect([...ITEM_COMMUNITY_STATES].sort()).toEqual(
      [...COMMUNITY_DOCUMENT_STATES, 'gone'].sort(),
    );
  });
});
