import { describe, expect, it, vi } from 'vitest';
import { answerInternal, type InternalRoom } from './room-internal';

// The room's /mutation (docs/specs/024-agents/pages-for-agents.md "The route"): the ops the worker
// originates are sequenced; anything else is refused.
function room() {
  const sequenceMutation = vi.fn(() => 1);
  return { room: { sequenceMutation } as unknown as InternalRoom, sequenceMutation };
}

const post = (op: unknown) =>
  new Request('https://room/mutation', { method: 'POST', body: JSON.stringify({ op }) });

describe('the room’s /mutation', () => {
  it('sequences the photo of a page an agent added or duplicated', async () => {
    const r = room();
    const op = { kind: 'photo', tabId: 't', pageId: 'p', ops: [] };
    const res = await answerInternal(r.room, post(op), new URL('https://room/mutation'));
    expect(res?.status).toBe(204);
    expect(r.sequenceMutation).toHaveBeenCalledWith('system', op);
  });

  it('refuses an op the worker never originates', async () => {
    const r = room();
    const res = await answerInternal(
      r.room,
      post({ kind: 'tab', tab: {} }),
      new URL('https://room/mutation'),
    );
    expect(res?.status).toBe(400);
    expect(r.sequenceMutation).not.toHaveBeenCalled();
  });
});
