import { describe, expect, it } from 'vitest';
import {
  beginGrace,
  claimBaton,
  FACILITATOR_GRACE_MS,
  FREE_BATON,
  graceExpired,
  grantBaton,
  mayRunSession,
  reclaimBaton,
  releaseBaton,
  type Asker,
  type FacilitatorState,
} from './facilitator';

const editor = (id: string): Asker => ({ presenceId: id, role: 'edit', isOwner: false });
const owner = (id: string): Asker => ({ presenceId: id, role: 'edit', isOwner: true });
const viewer = (id: string): Asker => ({ presenceId: id, role: 'view', isOwner: false });
const held = (holder: string, token = 'tok'): FacilitatorState => ({ holder, token });

describe('claiming a free baton', () => {
  it('gives it to any editor who asks', () => {
    const move = claimBaton(FREE_BATON, editor('a'), 'new');
    expect(move).toEqual({ next: { holder: 'a', token: 'new' }, tokenTo: 'a', reason: 'claim' });
  });

  it('refuses a viewer, whose tools would all be disabled anyway', () => {
    expect(claimBaton(FREE_BATON, viewer('v'), 'new')).toBeNull();
  });

  it('is a no-op for the person already holding it', () => {
    expect(claimBaton(held('a'), owner('a'), 'new')).toBeNull();
  });
});

describe('claiming a held baton', () => {
  it('refuses another editor: one session, one pace', () => {
    expect(claimBaton(held('a'), editor('b'), 'new')).toBeNull();
  });

  it('lets the OWNER take it back, which is the whole point of the owner bit', () => {
    const move = claimBaton(held('a'), owner('b'), 'new');
    expect(move?.next).toEqual({ holder: 'b', token: 'new' });
  });
});

describe('granting', () => {
  it('lets the holder pass it on', () => {
    const move = grantBaton(held('a'), editor('a'), editor('b'), 'new');
    expect(move).toEqual({ next: { holder: 'b', token: 'new' }, tokenTo: 'b', reason: 'grant' });
  });

  it('lets the owner appoint somebody while another person holds it', () => {
    expect(grantBaton(held('a'), owner('o'), editor('b'), 'new')?.next.holder).toBe('b');
  });

  it('lets any editor hand out a FREE baton', () => {
    // No more reach than taking it and stepping down, which they can do.
    expect(grantBaton(FREE_BATON, editor('a'), editor('b'), 'new')?.next.holder).toBe('b');
  });

  it('refuses a bystander while somebody else holds it', () => {
    expect(grantBaton(held('a'), editor('c'), editor('b'), 'new')).toBeNull();
  });

  it('refuses a viewer as the target', () => {
    expect(grantBaton(FREE_BATON, editor('a'), viewer('v'), 'new')).toBeNull();
  });

  it('refuses a target who has already left', () => {
    expect(grantBaton(FREE_BATON, editor('a'), null, 'new')).toBeNull();
  });
});

describe('releasing', () => {
  it('lets the holder step down', () => {
    expect(releaseBaton(held('a'), editor('a'))?.next).toEqual(FREE_BATON);
  });

  it('lets the owner end somebody else’s turn', () => {
    expect(releaseBaton(held('a'), owner('o'))?.next).toEqual(FREE_BATON);
  });

  it('refuses anybody else', () => {
    expect(releaseBaton(held('a'), editor('b'))).toBeNull();
  });

  it('is a no-op on a free baton', () => {
    expect(releaseBaton(FREE_BATON, owner('o'))).toBeNull();
  });
});

describe('reclaiming after a refresh', () => {
  // The token is the identity: the room has none to check against.
  it('hands the baton to the new socket presenting the right token', () => {
    expect(reclaimBaton(held('old', 'tok'), editor('new'), 'tok')).toEqual({
      holder: 'new',
      token: 'tok',
    });
  });

  it('clears the grace deadline by rebuilding the state', () => {
    const away = { ...held('old', 'tok'), graceUntil: 123 };
    expect(reclaimBaton(away, editor('new'), 'tok')?.graceUntil).toBeUndefined();
  });

  it('refuses a wrong token', () => {
    expect(reclaimBaton(held('old', 'tok'), editor('new'), 'guess')).toBeNull();
  });

  it('refuses when the baton has since moved, because the token was reminted', () => {
    expect(reclaimBaton(held('other', 'fresh'), editor('new'), 'tok')).toBeNull();
  });

  it('refuses an empty token against a free baton', () => {
    expect(reclaimBaton(FREE_BATON, editor('a'), undefined)).toBeNull();
    expect(reclaimBaton(FREE_BATON, editor('a'), 'tok')).toBeNull();
  });
});

describe('the grace period', () => {
  it('starts the clock when the holder goes away', () => {
    const next = beginGrace(held('a'), 'a', 1_000);
    expect(next?.graceUntil).toBe(1_000 + FACILITATOR_GRACE_MS);
    expect(next?.holder).toBe('a');
  });

  it('ignores anybody else leaving', () => {
    expect(beginGrace(held('a'), 'b', 1_000)).toBeNull();
  });

  it('expires only once the deadline passes', () => {
    const away = beginGrace(held('a'), 'a', 1_000)!;
    expect(graceExpired(away, 1_000 + FACILITATOR_GRACE_MS - 1)).toBe(false);
    expect(graceExpired(away, 1_000 + FACILITATOR_GRACE_MS)).toBe(true);
  });

  it('never expires a baton nobody is holding, or one with no clock running', () => {
    expect(graceExpired(FREE_BATON, Date.now())).toBe(false);
    expect(graceExpired(held('a'), Date.now())).toBe(false);
  });
});

describe('who may run the session tools', () => {
  it('is everybody while the baton is free, so an untouched room is unchanged', () => {
    expect(mayRunSession(FREE_BATON, 'anyone')).toBe(true);
  });

  it('is the holder alone once somebody takes it', () => {
    expect(mayRunSession(held('a'), 'a')).toBe(true);
    expect(mayRunSession(held('a'), 'b')).toBe(false);
  });
});
