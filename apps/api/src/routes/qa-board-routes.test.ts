import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { qaVoterId, type QaNote } from '@livediagram/diagram';
import type { QaWriteRequest } from '../qa-board-write';

// The Q&A board endpoint (docs/specs/012-collaboration/qa-board.md). What the ROUTE has to get right: the role
// split (audience verbs on read access, board-running verbs on edit access),
// an actor derived from the authenticated caller rather than the request, and
// handing the write to the diagram's room. The write and its serialisation are
// the room's, covered in diagram-room-qa.test.ts and qa-board-write.test.ts.

const { db, gates } = vi.hoisted(() => ({
  db: { getDiagram: vi.fn(), getParticipant: vi.fn() },
  gates: { gateRead: vi.fn(), gateEdit: vi.fn() },
}));
vi.mock('../db', () => db);
vi.mock('./context', async (orig) => ({
  ...(await orig<typeof import('./context')>()),
  gateRead: gates.gateRead,
  gateEdit: gates.gateEdit,
}));

import { handleQaBoardRoute } from './qa-board-routes';

const PATH = '/api/diagrams/d1/tabs/t1/qa';

function setup(reply: () => Response = () => Response.json({ notes: [], rev: 1 })) {
  const sent: { url: string; body: QaWriteRequest; room: string }[] = [];
  let room = '';
  const env = {
    DIAGRAM_ROOM: {
      idFromName: (n: string) => n,
      get: (id: string) => {
        room = id;
        return {
          fetch: vi.fn(async (url: string, init: { body: string }) => {
            sent.push({ url, body: JSON.parse(init.body), room });
            return reply();
          }),
        };
      },
    },
  } as never;
  const call = (body: unknown, owner = 'owner-1') =>
    handleQaBoardRoute(makeTestRouteContext('POST', PATH, { owner, body, env }));
  return { call, sent };
}

beforeEach(() => {
  for (const fn of [...Object.values(db), ...Object.values(gates)]) fn.mockReset();
  db.getDiagram.mockResolvedValue({ id: 'd1', ownerId: 'owner-0', teamId: null, tabs: [] });
  db.getParticipant.mockResolvedValue({ name: 'Priya', color: '#0af' });
  gates.gateRead.mockResolvedValue(true);
  gates.gateEdit.mockResolvedValue(false);
});

describe('handleQaBoardRoute', () => {
  it('ignores other paths', async () => {
    const res = await handleQaBoardRoute(makeTestRouteContext('POST', '/api/diagrams/d1/tabs/t1'));
    expect(res).toBeNull();
  });

  it('lets a read-only visitor add a note, with the author from their participant row', async () => {
    const { call, sent } = setup();
    const res = await call({
      elementId: 'b1',
      action: { type: 'add', id: 'n1', text: 'Why?', anonymous: false, author: { name: 'Fake' } },
    });
    expect(res!.status).toBe(200);
    expect(gates.gateEdit).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe('https://room/qa');
    // The diagram's own room, so every write for it queues in one place.
    expect(sent[0]!.room).toBe('d1');
    expect(sent[0]!.body).toMatchObject({
      diagramId: 'd1',
      tabId: 't1',
      elementId: 'b1',
      action: { type: 'add', id: 'n1', text: 'Why?', anonymous: false },
      actor: { author: { name: 'Priya', color: '#0af' } },
    });
    // Nothing the client claimed about itself survives.
    expect(JSON.stringify(sent[0]!.body)).not.toContain('Fake');
  });

  it('sends no author for an anonymous note and never reads the participant', async () => {
    const { call, sent } = setup();
    await call({
      elementId: 'b1',
      action: { type: 'add', id: 'n1', text: 'Why?', anonymous: true },
    });
    expect(sent[0]!.body.actor.author).toBeNull();
    expect(db.getParticipant).not.toHaveBeenCalled();
  });

  it('derives the voter id from the authenticated caller and returns it', async () => {
    const notes: QaNote[] = [{ id: 'n1', text: 'a', at: 1, voters: ['x'] }];
    const { call, sent } = setup(() => Response.json({ notes, rev: 7 }));
    const res = await call({ elementId: 'b1', action: { type: 'vote', noteId: 'n1', on: true } });
    const expected = await qaVoterId('owner-1', 'b1');
    expect(sent[0]!.body.actor.voterId).toBe(expected);
    expect(await res!.json()).toEqual({ notes, rev: 7, voterId: expected });
  });

  it('needs edit access to run the board', async () => {
    const { call, sent } = setup();
    const res = await call({ elementId: 'b1', action: { type: 'clear' } });
    expect(res!.status).toBe(403);
    expect(gates.gateEdit).toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('refuses a caller who cannot read the diagram', async () => {
    gates.gateRead.mockResolvedValue(false);
    const { call } = setup();
    const res = await call({ elementId: 'b1', action: { type: 'vote', noteId: 'n', on: true } });
    expect(res!.status).toBe(403);
  });

  it('rejects a malformed action before touching the room', async () => {
    const { call, sent } = setup();
    expect((await call({ elementId: 'b1', action: { type: 'nuke' } }))!.status).toBe(400);
    expect((await call({ action: { type: 'clear' } }))!.status).toBe(400);
    expect(sent).toEqual([]);
  });

  it('relays the room’s refusals', async () => {
    const missing = setup(() => new Response(null, { status: 404 }));
    expect(
      (await missing.call({ elementId: 'b1', action: { type: 'vote', noteId: 'n', on: true } }))!
        .status,
    ).toBe(404);
    const busy = setup(() => new Response(null, { status: 409 }));
    expect(
      (await busy.call({ elementId: 'b1', action: { type: 'vote', noteId: 'n', on: true } }))!
        .status,
    ).toBe(409);
  });
});
