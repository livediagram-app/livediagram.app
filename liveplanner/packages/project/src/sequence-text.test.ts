import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveplanner/vitest-config/cpu-time';
import { createShape, parseSequenceText, sequenceToText } from './index';

// docs/specs/009-elements/sequence-diagram.md "The Sequence dialog" (Text).

const seq = () => createShape('sequence', 0, 0);

describe('sequence text', () => {
  it('writes the participants, then a line per message', () => {
    const el = seq();
    expect(sequenceToText(el.sequenceParticipants!, el.sequenceMessages!)).toBe(
      [
        'participant Browser',
        'participant API',
        'participant Database',
        '',
        'Browser -> API: Place order',
        'API -> API: Validate',
        'API -> Database: Insert order',
        'Database --> API: Order id',
        'API --> Browser: 201 Created',
      ].join('\n'),
    );
  });

  it('round-trips, keeping each participant its id', () => {
    const el = seq();
    const text = sequenceToText(el.sequenceParticipants!, el.sequenceMessages!);
    const back = parseSequenceText(text, el.sequenceParticipants);
    expect(back.participants).toEqual(el.sequenceParticipants);
    expect(back.messages).toEqual(el.sequenceMessages);
    expect(back.unread).toEqual([]);
  });

  it('writes two participants sharing a name apart, so the text never merges them', () => {
    const ps = [
      { id: 'a', label: 'API' },
      { id: 'b', label: 'api' },
      { id: 'c', label: 'API 2' },
    ];
    const ms = [
      { from: 'a', to: 'b', label: 'One', kind: 'call' as const },
      { from: 'b', to: 'c', label: 'Two', kind: 'call' as const },
    ];
    const text = sequenceToText(ps, ms);
    expect(text.split('\n').slice(0, 3)).toEqual([
      'participant API',
      'participant api 2',
      'participant API 2 2',
    ]);
    const back = parseSequenceText(text, ps);
    expect(back.participants.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(back.messages.map((m) => [m.from, m.to, m.label])).toEqual([
      ['a', 'b', 'One'],
      ['b', 'c', 'Two'],
    ]);
  });

  it('reads a declared name holding a colon whole after an arrow', () => {
    const ps = [
      { id: 'app', label: 'App' },
      { id: 'db', label: 'DB: Postgres' },
    ];
    const ms = [
      { from: 'app', to: 'db', label: 'Query: users', kind: 'call' as const },
      { from: 'db', to: 'app', label: '', kind: 'reply' as const },
    ];
    const back = parseSequenceText(sequenceToText(ps, ms), ps);
    expect(back.participants).toEqual(ps);
    expect(back.messages).toEqual(ms);
    // A name not declared still ends at the first colon; a longer declared name wins over a shorter one.
    const r = parseSequenceText('participant A\nparticipant AB\nA -> AB: hi\nA -> C: D: e');
    expect(r.messages.map((m) => [m.to, m.label])).toEqual([
      ['p2', 'hi'],
      ['p3', 'D: e'],
    ]);
  });

  it('reads the three arrows, actors, notes and names it has not met', () => {
    const r = parseSequenceText(
      [
        'actor Customer',
        '// the happy path',
        'Customer -> Shop: Buy',
        'Shop ~> Mailer: Send receipt',
        'Mailer --> Shop: Queued',
        'Shop -> Shop',
      ].join('\n'),
    );
    expect(r.participants.map((p) => [p.label, !!p.actor])).toEqual([
      ['Customer', true],
      ['Shop', false],
      ['Mailer', false],
    ]);
    expect(r.messages.map((m) => m.kind)).toEqual(['call', 'async', 'reply', 'call']);
    expect(r.messages[3]).toMatchObject({ label: '', from: r.messages[3]!.to });
  });

  it('reads the arrows other tools write, without their activation marks', () => {
    const r = parseSequenceText('A ->>+B: go\nB -->>-A: done\nA -) C: fire');
    expect(r.messages.map((m) => m.kind)).toEqual(['call', 'reply', 'async']);
    expect(r.participants.map((p) => p.label)).toEqual(['A', 'B', 'C']);
  });

  it('matches names case-insensitively (the spelling typed wins) and gives new ones fresh ids', () => {
    const known = [
      { id: 'api', label: 'API' },
      { id: 'p1', label: 'Old' },
    ];
    const r = parseSequenceText('api -> Worker: run', known);
    expect(r.participants).toEqual([
      { id: 'api', label: 'api' },
      { id: 'p2', label: 'Worker' },
    ]);
  });

  it('names the lines it cannot read and keeps the rest', () => {
    const r = parseSequenceText('A -> B: ok\nthis is not a message\nB --> A: back');
    expect(r.unread).toEqual([2]);
    expect(r.messages).toHaveLength(2);
  });

  it('stops at 12 participants and 60 messages, naming the lines past them', () => {
    const many = Array.from({ length: 14 }, (_, i) => `participant P${i}`).join('\n');
    expect(parseSequenceText(many).participants).toHaveLength(12);
    expect(parseSequenceText(many).unread).toEqual([13, 14]);
    const msgs = Array.from({ length: 62 }, () => 'A -> B: x').join('\n');
    expect(parseSequenceText(msgs).messages).toHaveLength(60);
    expect(parseSequenceText(msgs).unread).toEqual([61, 62]);
  });

  it('reads each arrow by the longest form, past dashes in a name, the extra dashes of a long arrow left off', () => {
    const r = parseSequenceText(
      [
        'Front-end -> API: a',
        'API --> Front-end: b',
        'A ---> B: c',
        'A ~> B: d',
        'A -) B: e',
        'A ->> B: f',
        'A -->> B: g',
        'A - > B: none',
      ].join('\n'),
    );
    expect(r.messages.map((m) => [m.label, m.kind])).toEqual([
      ['a', 'call'],
      ['b', 'reply'],
      ['c', 'reply'],
      ['d', 'async'],
      ['e', 'async'],
      ['f', 'call'],
      ['g', 'reply'],
    ]);
    expect(r.participants.map((p) => p.label)).toEqual(['Front-end', 'API', 'A', 'B']);
    expect(r.unread).toEqual([8]);
  });

  it('reads a hostile paste in linear time', () => {
    const text =
      `${'-'.repeat(390)}\n`.repeat(1000) +
      `A${' -'.repeat(190)}x -> B\n`.repeat(1000) +
      `${'~'.repeat(100000)}`;
    expect(cpuMsOf(() => parseSequenceText(text))).toBeLessThan(cpuBudgetMs(200));
  });
});
