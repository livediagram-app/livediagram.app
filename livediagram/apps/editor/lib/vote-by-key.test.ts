import { describe, expect, it, vi } from 'vitest';
import {
  applyVoteDelta,
  createShape,
  createSticky,
  type Element,
  type Layer,
  type TabVote,
} from '@livediagram/document';
import { resolveEditorCapabilities } from './editor-capabilities';
import {
  dotsLeftText,
  voteByKey,
  voteKeyDelta,
  voteKeyHandler,
  VOTE_KEY_LOCKED,
  type VoteByKeyArgs,
} from './vote-by-key';

// Dot voting from the keyboard (docs/specs/012-collaboration/blueprints/vote-keys.md "Testing").

const idea = { ...createSticky(0, 0), label: 'Idea' } as Element;
const frame = createShape('frame', 200, 0) as Element;
const elements = [idea, frame];

const openVote = (over: Partial<TabVote> = {}): TabVote => ({
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes: {},
  ...over,
});

// A voter whose handlers apply the dot to `state.vote`, as useTabSession's do.
function args(over: Partial<VoteByKeyArgs> = {}) {
  const state = { vote: over.vote ?? openVote() };
  const cast = vi.fn((id: string) => {
    state.vote = applyVoteDelta(state.vote, id, 'me', 1);
    return true;
  });
  const retract = vi.fn((id: string) => {
    state.vote = applyVoteDelta(state.vote, id, 'me', -1);
    return true;
  });
  const a: VoteByKeyArgs = {
    elementId: idea.id,
    delta: 1,
    elements,
    vote: state.vote,
    layers: undefined,
    selfId: 'me',
    canTakePart: true,
    cast,
    retract,
    ...over,
  };
  return { a, cast, retract, state };
}

describe('voteKeyDelta', () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
    voteKeyDelta({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods });
  it('reads + and = as a dot on and - as a dot off', () => {
    expect(key('+')).toBe(1);
    expect(key('=')).toBe(1);
    expect(key('-')).toBe(-1);
  });
  it('leaves every other key, and a chord (Cmd/Ctrl zoom, Alt), alone', () => {
    expect(key('a')).toBeNull();
    expect(key('_')).toBeNull();
    expect(key('+', { metaKey: true })).toBeNull();
    expect(key('-', { ctrlKey: true })).toBeNull();
    expect(key('=', { altKey: true })).toBeNull();
  });
});

describe('dotsLeftText', () => {
  it('counts dots, singular for a budget of one', () => {
    expect(dotsLeftText(2, 3)).toBe('2 of 3 dots left');
    expect(dotsLeftText(0, 1)).toBe('0 of 1 dot left');
  });
});

describe('voteByKey', () => {
  it('casts a dot and says what happened and the dots left', () => {
    const { a, cast } = args();
    expect(voteByKey(a)).toBe("Dot added to 'Idea'. 2 of 3 dots left.");
    expect(cast).toHaveBeenCalledWith(idea.id);
  });

  it('takes one of your dots back', () => {
    const { a, retract } = args({
      delta: -1,
      vote: openVote({ votes: { [idea.id]: ['me', 'me'] } }),
    });
    expect(voteByKey(a)).toBe("Dot removed from 'Idea'. 2 of 3 dots left.");
    expect(retract).toHaveBeenCalledWith(idea.id);
  });

  it('refuses past the budget, as the plus is disabled', () => {
    const { a, cast } = args({ vote: openVote({ votesPerPerson: 1, votes: { x: ['me'] } }) });
    expect(voteByKey(a)).toBe('No dots left.');
    expect(cast).not.toHaveBeenCalled();
  });

  it('refuses a second dot on a one-per-item vote', () => {
    const { a, cast } = args({
      vote: openVote({ onePerElement: true, votes: { [idea.id]: ['me'] } }),
    });
    expect(voteByKey(a)).toBe("One dot each: 'Idea' already has yours.");
    expect(cast).not.toHaveBeenCalled();
  });

  it('says there is nothing to take back when none of the dots are yours', () => {
    const { a, retract } = args({ delta: -1, vote: openVote({ votes: { [idea.id]: ['them'] } }) });
    expect(voteByKey(a)).toBe("No dot of yours on 'Idea'.");
    expect(retract).not.toHaveBeenCalled();
  });

  it('says so when the tab refuses the dot (locked)', () => {
    expect(voteByKey(args({ cast: () => false }).a)).toBe(VOTE_KEY_LOCKED);
    expect(
      voteByKey(
        args({ delta: -1, retract: () => false, vote: openVote({ votes: { [idea.id]: ['me'] } }) })
          .a,
      ),
    ).toBe(VOTE_KEY_LOCKED);
  });

  it('is not the vote key without an open vote, so the key types into the label as before', () => {
    expect(voteByKey(args({ vote: null }).a)).toBeNull();
    expect(voteByKey(args({ vote: openVote({ active: false }) }).a)).toBeNull();
  });

  it('is not the vote key on an element the vote does not take (a frame, another layer, a gone one)', () => {
    expect(voteByKey(args({ elementId: frame.id }).a)).toBeNull();
    expect(voteByKey(args({ elementId: 'gone' }).a)).toBeNull();
    const layers: Layer[] = [
      { id: 'base', name: 'Base' },
      { id: 'top', name: 'Top' },
    ];
    expect(voteByKey(args({ layers, vote: openVote({ voteLayerId: 'top' }) }).a)).toBeNull();
  });
});

describe('vote keys by share role', () => {
  // The pointer's gate (CanvasElementsLayer): an Editor or a Participant casts, a Viewer never does.
  const handler = (role: 'edit' | 'participate' | 'view') => {
    const { a, cast } = args();
    const speak = vi.fn();
    const on = voteKeyHandler(
      { ...a, canTakePart: resolveEditorCapabilities({ level: role, adderKey: null }).takePart },
      speak,
    );
    return { on, cast, speak };
  };

  it('lets an Editor and a Participant cast by key, and speaks the outcome', () => {
    for (const role of ['edit', 'participate'] as const) {
      const { on, cast, speak } = handler(role);
      expect(on?.(idea.id, 1)).toBe(true);
      expect(cast).toHaveBeenCalledTimes(1);
      expect(speak).toHaveBeenCalledWith("Dot added to 'Idea'. 2 of 3 dots left.");
    }
  });

  it('gives a Viewer no vote key at all', () => {
    expect(handler('view').on).toBeUndefined();
    const { a, cast } = args({ canTakePart: false });
    expect(voteByKey(a)).toBeNull();
    expect(cast).not.toHaveBeenCalled();
  });

  it('hands a key the vote does not take back, unspoken', () => {
    const { on, speak } = handler('edit');
    expect(on?.(frame.id, 1)).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });
});
