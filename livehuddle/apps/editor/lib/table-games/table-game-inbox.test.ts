import { describe, expect, it, vi } from 'vitest';
import { onGameOp, receiveGameOp } from './table-game-inbox';

// docs/specs/009-elements/social-pieces.md "The wire".
describe('the table game inbox', () => {
  const input = { kind: 'game-input', tabId: 't', pieceId: 'table', seat: 0, axis: 0.5 };
  const miss = {
    kind: 'game-event',
    tabId: 't',
    pieceId: 'table',
    seat: 1,
    game: 'ping-pong',
    match: 'm1',
    seq: 2,
    event: 'miss',
    score: [1, 0],
  };

  it('hands a parsed paddle or moment to every listener, and nothing malformed', () => {
    const heard = vi.fn();
    const stop = onGameOp(heard);
    receiveGameOp('p1', { ...input, extra: 1 });
    receiveGameOp('p2', miss);
    receiveGameOp('p3', { ...input, axis: 4 });
    receiveGameOp('p4', { ...miss, event: 'hit' });
    receiveGameOp('p5', null);
    expect(heard.mock.calls).toEqual([
      ['p1', input],
      ['p2', miss],
    ]);
    stop();
    receiveGameOp('p1', input);
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
