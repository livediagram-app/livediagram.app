import { describe, expect, it } from 'vitest';
import { readEvents } from './events';
import { isAskEvent, type AskEvent } from './wire';

const bodyOf = (...chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
};

const all = async (body: ReadableStream<Uint8Array>): Promise<AskEvent[]> => {
  const events: AskEvent[] = [];
  for await (const event of readEvents(body, isAskEvent)) events.push(event);
  return events;
};

describe('a server-sent-events body', () => {
  it('is read event by event, however its bytes fall', async () => {
    const stream =
      ': a comment\r\nevent: delta\r\ndata: {"type":"delta","text":"Hel"}\r\n\r\n' +
      'event: delta\ndata: {"type":"delta",\ndata: "text":"lo"}\n\n' +
      'data: not json\n\n' +
      'data: {"type":"other"}\n\n' +
      'id: 7\n\n' +
      'data:{"type":"error","kind":"other","message":"No."}';
    for (const size of [1, 5, 1000]) {
      const chunks = stream.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g'))!;
      expect(await all(bodyOf(...chunks))).toEqual([
        { type: 'delta', text: 'Hel' },
        { type: 'delta', text: 'lo' },
        { type: 'error', kind: 'other', message: 'No.' },
      ]);
    }
    expect(await all(bodyOf())).toEqual([]);
  });

  it('knows an Ask event by its type', () => {
    expect(isAskEvent(null)).toBe(false);
    expect(isAskEvent('delta')).toBe(false);
    expect(isAskEvent({ type: 'done' })).toBe(true);
    expect(isAskEvent({ type: 'nope' })).toBe(false);
  });
});
