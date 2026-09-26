// @vitest-environment jsdom

// The Done check's join (docs/specs/012-collaboration/done-check.md, docs/specs/012-collaboration/participant-responses.md). Rendered rather than tested
// through `doneSplit` alone, because the bug it pins was never in doneSplit:
// that function is correct and was being handed the wrong ids.
//
// A peer appears in the roster under the room's presence id, which is minted
// per socket (docs/specs/015-api/public-api-and-tokens.md §6) and matches nothing that was ever written down. Their
// mark is saved under their document-write key. Joining those two showed every
// viewer their own mark and nobody else's — which is exactly what the card is
// for, so the card did nothing.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DONE_VALUE, type ShapeElement } from '@livediagram/diagram';

import type { Participant } from '@/lib/identity';
import { DoneCheckFace } from './DoneCheckFace';

// Us: `id` is our own owner id, `key` is what we write onto the card.
const SELF: Participant = {
  id: 'owner-me',
  key: 'k-me',
  name: 'Me',
  color: '#0ea5e9',
  status: 'online',
};
// A peer, as the roster actually receives them: a per-socket presence id that
// looks nothing like the key their answer is saved under.
const PEER: Participant = {
  id: 'presence-9f2c-fresh-every-socket',
  key: 'k-ada',
  name: 'Ada',
  color: '#f43f5e',
  status: 'online',
};

function card(responseKeys: string[]): ShapeElement {
  return {
    id: 'el-1',
    type: 'shape',
    shape: 'done-check',
    x: 0,
    y: 0,
    width: 240,
    height: 220,
    label: '',
    responses: responseKeys.map((participantId) => ({
      participantId,
      value: DONE_VALUE,
      at: 1,
    })),
  } as ShapeElement;
}

function count(): string {
  return screen.getByText(/^\d+\/\d+$/).textContent ?? '';
}

describe('DoneCheckFace', () => {
  afterEach(cleanup);

  it('counts a peer’s mark, not just our own', () => {
    render(
      <DoneCheckFace
        element={card(['k-ada'])}
        label=""
        textColor="#000"
        selfKey="k-me"
        participants={[SELF, PEER]}
      />,
    );
    expect(count()).toBe('1/2');
    // And it says WHO: the roster is rendered by matching the saved key back
    // to the person, so a mismatch shows an empty Done list rather than a
    // wrong one.
    expect(screen.getByText(/^Done · 1$/)).toBeTruthy();
    expect(screen.getByText(/^Waiting on · 1$/)).toBeTruthy();
  });

  it('completes when everyone in the room has marked themselves', () => {
    render(
      <DoneCheckFace
        element={card(['k-me', 'k-ada'])}
        label=""
        textColor="#000"
        selfKey="k-me"
        participants={[SELF, PEER]}
      />,
    );
    expect(count()).toBe('2/2');
    expect(screen.getByText("Everyone's done.")).toBeTruthy();
  });

  it('reads our own mark from the key we write under, not our owner id', () => {
    // The footer flips to "I'm not done" only when it recognises OUR mark. Keyed
    // on the owner id it would never recognise it, because that is not what
    // `respond` writes.
    render(
      <DoneCheckFace
        element={card(['k-me'])}
        label=""
        textColor="#000"
        selfKey="k-me"
        participants={[SELF, PEER]}
      />,
    );
    expect(screen.getByText("I'm not done")).toBeTruthy();
  });

  it('ignores a mark from somebody who has left', () => {
    // docs/specs/012-collaboration/done-check.md: the waiting list is derived from who is in the room NOW, so a
    // response from a departed peer is ignored rather than deleted.
    render(
      <DoneCheckFace
        element={card(['k-ada'])}
        label=""
        textColor="#000"
        selfKey="k-me"
        participants={[SELF]}
      />,
    );
    expect(count()).toBe('0/1');
  });

  it('falls back to the presence id for a peer whose client sends no key', () => {
    // An older client publishes no key. They still render in the roster and
    // simply match nothing — the behaviour before the key existed, not a crash.
    const legacy: Participant = {
      id: 'presence-old',
      name: 'Legacy',
      color: '#0f0',
      status: 'online',
    };
    render(
      <DoneCheckFace
        element={card(['k-me'])}
        label=""
        textColor="#000"
        selfKey="k-me"
        participants={[SELF, legacy]}
      />,
    );
    expect(count()).toBe('1/2');
  });
});
