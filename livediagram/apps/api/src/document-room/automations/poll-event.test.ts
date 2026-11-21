import { describe, expect, it } from 'vitest';
import type { LivePoll } from '@livediagram/api-schema';
import { POLL_RESULT_LINES_MAX, pollEndedEvent, pollEventData } from './poll-event';

// What a Poll Ended rule reads of a poll (docs/specs/013-workspace/automations.md "Values of its own").

const poll = (over: Partial<LivePoll> = {}): LivePoll => ({
  id: 'p1',
  question: 'Which first?',
  style: 'choice',
  options: ['Search', 'Sharing', 'Speed'],
  startedAt: 1,
  ...over,
});

describe('pollEventData', () => {
  it('lists every option with its count, the most chosen first, ties in the poll’s order', () => {
    const data = pollEventData(poll(), { a: 'Speed', b: 'Speed', c: 'Search', d: null });
    expect(data).toEqual({
      'poll.question': 'Which first?',
      'poll.results': 'Speed: 2\nSearch: 1\nSharing: 0',
      'poll.answers': 3,
    });
  });

  it('counts a skip as no answer, and a poll nobody answered as zeroes', () => {
    expect(pollEventData(poll(), { a: null })).toMatchObject({
      'poll.results': 'Search: 0\nSharing: 0\nSpeed: 0',
      'poll.answers': 0,
    });
  });

  it('groups a free-text poll’s answers, and keeps at most a bounded number of lines', () => {
    const answers: Record<string, string> = {};
    for (let i = 0; i < 200; i += 1) answers[`k${i}`] = i < 3 ? 'Same thing' : `Answer ${i}`;
    const data = pollEventData(poll({ style: 'text', options: [] }), answers);
    const lines = String(data['poll.results']).split('\n');
    expect(lines[0]).toBe('Same thing: 3');
    expect(lines).toHaveLength(POLL_RESULT_LINES_MAX);
    expect(data['poll.answers']).toBe(200);
  });

  it('never carries an answer’s key', () => {
    const event = pollEndedEvent(poll(), { 'secret-key-of-ben': 'Speed' }, {}, 5);
    expect(event).toMatchObject({ id: 'poll:p1', kind: 'poll_ended', at: 5 });
    expect(JSON.stringify(event)).not.toContain('secret-key-of-ben');
  });
});
