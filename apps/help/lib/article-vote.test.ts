import { describe, expect, it, vi } from 'vitest';
import { createVoteTally } from './article-vote';

describe('createVoteTally (spec/22 Help votes)', () => {
  it('sends nothing until the reader leaves', () => {
    const emit = vi.fn();
    const tally = createVoteTally('format-painter', emit);
    tally.cast('yes');
    expect(emit).not.toHaveBeenCalled();
    tally.commit();
    expect(emit).toHaveBeenCalledWith('Helpful', 'format-painter');
  });

  it('counts a changed vote once, as the final choice', () => {
    const emit = vi.fn();
    const tally = createVoteTally('format-painter', emit);
    tally.cast('no');
    tally.cast('yes');
    tally.commit();
    expect(emit.mock.calls).toEqual([['Helpful', 'format-painter']]);
  });

  it('never re-sends the same standing vote on a second hide', () => {
    const emit = vi.fn();
    const tally = createVoteTally('format-painter', emit);
    tally.cast('no');
    tally.commit();
    tally.commit();
    tally.cast('no');
    tally.commit();
    expect(emit.mock.calls).toEqual([['Unhelpful', 'format-painter']]);
  });

  it('sends nothing for a reader who never voted, or with no article id', () => {
    const emit = vi.fn();
    createVoteTally('format-painter', emit).commit();
    const anonymous = createVoteTally('', emit);
    anonymous.cast('yes');
    anonymous.commit();
    expect(emit).not.toHaveBeenCalled();
  });
});
