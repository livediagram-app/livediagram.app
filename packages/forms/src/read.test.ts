import { describe, expect, it } from 'vitest';
import { readForm, readOptions } from './read';
import { OPTIONS_MAX, QUESTIONS_MAX, SECTIONS_MAX, UNTITLED_FORM } from './limits';

const q = (extra: Record<string, unknown> = {}) => ({
  id: 'q-1',
  type: 'short',
  prompt: 'Name',
  ...extra,
});
const form = (questions: unknown[], extra: Record<string, unknown> = {}) => ({
  heading: 'Form',
  sections: [{ id: 's-1', title: '', questions }],
  ...extra,
});

describe('readForm', () => {
  it('is null only for a non-object', () => {
    expect(readForm(null)).toBeNull();
    expect(readForm([])).toBeNull();
    expect(readForm('x')).toBeNull();
  });

  it('gives an empty object a titled form with one empty section', () => {
    expect(readForm({})).toEqual({
      v: 1,
      heading: UNTITLED_FORM,
      sections: [{ id: 's-1', title: '', questions: [] }],
    });
  });

  it('keeps every part of a well-formed form', () => {
    const raw = {
      heading: '  Bug Report ',
      description: 'Tell us',
      accent: '#DC2626',
      cover: { color: '#ABCDEF', style: 'gradient' },
      sections: [
        {
          id: 's-1',
          title: '',
          description: 'First',
          questions: [
            q({ help: 'Your name', required: true, placeholder: 'Ada', goesTo: { to: 'title' } }),
            {
              id: 'q-2',
              type: 'single',
              prompt: 'Pick',
              options: ['A', 'B'],
              other: true,
              dropdown: true,
            },
            { id: 'q-3', type: 'multi', prompt: 'Many', options: ['A', 'B', 'C'], min: 1, max: 2 },
            { id: 'q-4', type: 'number', prompt: 'N', min: 0, max: 9, whole: true },
            {
              id: 'q-5',
              type: 'rating',
              prompt: 'R',
              scale: 10,
              style: 'numbers',
              lowLabel: 'Low',
              highLabel: 'High',
              goesTo: { to: 'field', fieldId: 'f-score' },
            },
          ],
        },
      ],
      destination: { tabId: 'tab-1', typeId: 'bug', status: 'triage~k1' },
      closesAt: 1000,
      limit: 50,
      confirmation: 'Thanks!',
      closedMessage: 'Closed.',
      starter: 'bug-report',
    };
    const read = readForm(raw)!;
    expect(read.heading).toBe('Bug Report');
    // A colour an earlier build stored is dropped: the form wears its tab theme's.
    expect(read).not.toHaveProperty('accent');
    expect(read.cover).toEqual({ color: '#abcdef', style: 'gradient' });
    expect(readForm({ cover: { style: 'dots' } })!.cover).toEqual({ style: 'dots' });
    expect(readForm({ cover: { style: 'solid' } })!.cover).toBeUndefined();
    // A slide gradient is kept when both its colours are; a broken one is dropped.
    expect(readForm({ cover: { gradient: { from: '#FDE68A', to: '#fca5a5' } } })!.cover).toEqual({
      gradient: { from: '#fde68a', to: '#fca5a5' },
    });
    expect(
      readForm({ cover: { gradient: { from: 'red', to: '#fca5a5' } } })!.cover,
    ).toBeUndefined();
    expect(readForm({ cover: { gradient: 'sunrise' } })!.cover).toBeUndefined();
    expect(read.sections[0]!.description).toBe('First');
    expect(read.sections[0]!.questions).toEqual([
      {
        id: 'q-1',
        type: 'short',
        prompt: 'Name',
        help: 'Your name',
        required: true,
        placeholder: 'Ada',
        goesTo: { to: 'title' },
      },
      {
        id: 'q-2',
        type: 'single',
        prompt: 'Pick',
        options: ['A', 'B'],
        other: true,
        dropdown: true,
      },
      { id: 'q-3', type: 'multi', prompt: 'Many', options: ['A', 'B', 'C'], min: 1, max: 2 },
      { id: 'q-4', type: 'number', prompt: 'N', min: 0, max: 9, whole: true },
      {
        id: 'q-5',
        type: 'rating',
        prompt: 'R',
        scale: 10,
        style: 'numbers',
        lowLabel: 'Low',
        highLabel: 'High',
        goesTo: { to: 'field', fieldId: 'f-score' },
      },
    ]);
    expect(read.destination).toEqual(raw.destination);
    expect(read.closesAt).toBe(1000);
    expect(read.limit).toBe(50);
    expect(read.confirmation).toBe('Thanks!');
    expect(read.closedMessage).toBe('Closed.');
    expect(read.starter).toBe('bug-report');
  });

  it('drops what does not belong to a question type', () => {
    const read = readForm(
      form([
        {
          id: 'q-1',
          type: 'date',
          prompt: 'D',
          placeholder: 'x',
          options: ['A'],
          min: 1,
          scale: 4,
          dropdown: true,
        },
        { id: 'q-2', type: 'rating', prompt: 'R', scale: 2, lowLabel: 'L' },
        { id: 'q-3', type: 'rating', prompt: 'R', scale: 7.5, style: 'stars' },
      ]),
    )!;
    expect(read.sections[0]!.questions).toEqual([
      { id: 'q-1', type: 'date', prompt: 'D' },
      { id: 'q-2', type: 'rating', prompt: 'R', scale: 5, style: 'stars' },
      { id: 'q-3', type: 'rating', prompt: 'R', scale: 5, style: 'stars' },
    ]);
  });

  it('drops questions of an unknown type, bad ids and repeated ids', () => {
    const read = readForm(
      form([
        q(),
        q(),
        { id: 'Q 2', type: 'short', prompt: 'x' },
        { id: 'q-3', type: 'essay' },
        'nope',
      ]),
    )!;
    expect(read.sections[0]!.questions.map((x) => x.id)).toEqual(['q-1']);
  });

  it('keeps picks and bounds that make sense', () => {
    const multi = (min: unknown, max: unknown) =>
      readForm(form([{ id: 'q-1', type: 'multi', prompt: 'M', options: ['A', 'B'], min, max }]))!
        .sections[0]!.questions[0]!;
    expect(multi(0, 3)).not.toHaveProperty('min');
    expect(multi(0, 3)).not.toHaveProperty('max');
    expect(multi(1.5, 2)).toMatchObject({ max: 2 });
    expect(multi(2, 1)).toMatchObject({ min: 2 });
    expect(multi(2, 1)).not.toHaveProperty('max');
    const num = readForm(
      form([{ id: 'q-1', type: 'number', prompt: 'N', min: 'a', max: Infinity }]),
    )!.sections[0]!.questions[0]!;
    expect(num).toEqual({ id: 'q-1', type: 'number', prompt: 'N' });
  });

  it('keeps a sheet to send responses to, and drops a malformed one', () => {
    expect(readForm({ sheet: { tabId: 'tab-1', sheetId: 'AbCdEf123456' } })!.sheet).toEqual({
      tabId: 'tab-1',
      sheetId: 'AbCdEf123456',
    });
    expect(readForm({ sheet: { tabId: 'tab-1', sheetId: 'x' } })!.sheet).toBeUndefined();
    expect(readForm({ sheet: { tabId: 'tab 1', sheetId: 'AbCdEf123456' } })!.sheet).toBeUndefined();
    expect(readForm({ sheet: 'AbCdEf123456' })!.sheet).toBeUndefined();
  });

  it('keeps a question with no prompt yet, its prompt empty', () => {
    expect(readForm(form([{ id: 'q-1', type: 'short' }]))!.sections[0]!.questions[0]).toEqual({
      id: 'q-1',
      type: 'short',
      prompt: '',
    });
  });

  it('counts an Other option as a pick, and keeps a numbers scale without labels', () => {
    const read = readForm(
      form([
        { id: 'q-1', type: 'multi', prompt: 'M', options: ['A', 'B'], other: true, max: 3 },
        { id: 'q-2', type: 'rating', prompt: 'R', style: 'numbers' },
      ]),
    )!;
    expect(read.sections[0]!.questions[0]!.max).toBe(3);
    expect(read.sections[0]!.questions[1]).toEqual({
      id: 'q-2',
      type: 'rating',
      prompt: 'R',
      scale: 5,
      style: 'numbers',
    });
  });

  it('gives Title to the first question only', () => {
    const read = readForm(
      form([q({ goesTo: { to: 'title' } }), q({ id: 'q-2', goesTo: { to: 'title' } })]),
    )!;
    expect(read.sections[0]!.questions.map((x) => x.goesTo)).toEqual([{ to: 'title' }, undefined]);
  });

  it('reads Description and unknown targets as no target', () => {
    const read = readForm(
      form([
        q({ goesTo: { to: 'description' } }),
        q({ id: 'q-2', goesTo: { to: 'field', fieldId: 'bad id' } }),
        q({ id: 'q-3', goesTo: 'title' }),
      ]),
    )!;
    expect(read.sections[0]!.questions.every((x) => x.goesTo === undefined)).toBe(true);
  });

  it('caps sections and questions', () => {
    const sections = Array.from({ length: SECTIONS_MAX + 2 }, (_, i) => ({
      id: `s-${i}`,
      title: `S${i}`,
      questions: Array.from({ length: 20 }, (_, j) => ({
        id: `q-${i}-${j}`,
        type: 'short',
        prompt: 'x',
      })),
    }));
    const read = readForm({ sections })!;
    expect(read.sections).toHaveLength(SECTIONS_MAX);
    expect(read.sections.flatMap((s) => s.questions)).toHaveLength(QUESTIONS_MAX);
  });

  it('skips bad and repeated sections', () => {
    const read = readForm({
      sections: [
        { id: 's-1', title: 'A', questions: 'x' },
        { id: 's-1', title: 'B' },
        { title: 'C' },
        4,
      ],
    })!;
    expect(read.sections).toEqual([{ id: 's-1', title: 'A', questions: [] }]);
  });

  it('drops settings out of range', () => {
    const read = readForm({
      cover: { color: 'blue', style: 'zigzag' },
      destination: { tabId: 'tab 1', typeId: 'bug', status: 'x' },
      closesAt: -1,
      limit: 0,
      starter: 'survey',
    })!;
    expect(read).toEqual({
      v: 1,
      heading: UNTITLED_FORM,
      sections: [{ id: 's-1', title: '', questions: [] }],
    });
    expect(readForm({ cover: 'x', destination: 'x', limit: 2.5 })!.limit).toBeUndefined();
    expect(
      readForm({ destination: { tabId: 't', typeId: 'Bug', status: 'x' } })!.destination,
    ).toBeUndefined();
    expect(
      readForm({ destination: { tabId: 't', typeId: 'bug', status: ' x' } })!.destination,
    ).toBeUndefined();
  });
});

describe('readOptions', () => {
  it('trims, drops empties and repeats, and caps the count', () => {
    expect(readOptions(' A , a, , B, 3'.split(','))).toEqual(['A', 'B', '3']);
    expect(readOptions('x')).toEqual([]);
    const many = Array.from({ length: OPTIONS_MAX + 5 }, (_, i) => `O${i}`);
    expect(readOptions(many)).toHaveLength(OPTIONS_MAX);
  });
});
