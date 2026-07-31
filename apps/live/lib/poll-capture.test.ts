import { describe, expect, it } from 'vitest';
import type { LivePoll } from '@livediagram/api-schema';
import { pollResultElement } from './poll-capture';

const poll = (over: Partial<LivePoll> = {}): LivePoll => ({
  id: 'p1',
  question: 'Ship on Friday?',
  style: 'yesNo',
  options: [],
  startedAt: 0,
  ...over,
});

const answers = (values: (string | null)[]) =>
  new Map(values.map((v, i) => [`peer-${i}`, v] as const));

describe('pollResultElement', () => {
  it('turns a token poll into a bar chart labelled with the question', () => {
    const el = pollResultElement(poll(), answers(['Yes', 'Yes', 'No']), 10, 20);
    expect(el.shape).toBe('bar-chart');
    expect(el.label).toBe('Ship on Friday?');
    expect(el.pieSlices).toEqual([
      { label: 'Yes', value: 2 },
      { label: 'No', value: 1 },
    ]);
  });

  it('keeps an option nobody picked at zero (spec/126)', () => {
    // "Nobody chose C" is a result; dropping the empty bar would rewrite it.
    const el = pollResultElement(
      poll({ style: 'choice', options: ['A', 'B', 'C'] }),
      answers(['A', 'A', 'B']),
      0,
      0,
    );
    expect(el.pieSlices).toEqual([
      { label: 'A', value: 2 },
      { label: 'B', value: 1 },
      { label: 'C', value: 0 },
    ]);
  });

  it('does not count a skip as an answer', () => {
    const el = pollResultElement(poll(), answers(['Yes', null, null]), 0, 0);
    expect(el.pieSlices?.find((s) => s.label === 'Yes')?.value).toBe(1);
    expect(el.pieSlices?.find((s) => s.label === 'No')?.value).toBe(0);
  });

  it('covers all five rating buckets', () => {
    const el = pollResultElement(poll({ style: 'rating' }), answers(['5', '5', '3']), 0, 0);
    expect(el.pieSlices?.map((s) => s.label)).toEqual(['1', '2', '3', '4', '5']);
    expect(el.pieSlices?.at(-1)?.value).toBe(2);
  });

  it('turns a free-text poll into an idea box that is already open', () => {
    const el = pollResultElement(
      poll({ style: 'text', question: 'One word for the release?' }),
      answers(['tense', 'relieved', null]),
      0,
      0,
    );
    expect(el.shape).toBe('idea-box');
    expect(el.label).toBe('One word for the release?');
    // Already open: the room has just read these out loud.
    expect(el.ideasRevealed).toBe(true);
    expect(el.ideaCards).toEqual(['tense', 'relieved']);
  });

  it('lands where it was placed', () => {
    const el = pollResultElement(poll(), answers([]), 120, 340);
    expect(el.x).toBe(120);
    expect(el.y).toBe(340);
  });

  it('produces an empty-but-valid chart when nobody answered', () => {
    const el = pollResultElement(poll(), answers([]), 0, 0);
    expect(el.pieSlices).toEqual([
      { label: 'Yes', value: 0 },
      { label: 'No', value: 0 },
    ]);
  });
});
