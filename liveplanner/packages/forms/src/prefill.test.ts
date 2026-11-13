import { describe, expect, it } from 'vitest';
import { OTHER_ANSWER } from './answers';
import type { FormQuestion } from './model';
import { prefillSearch, readPrefill } from './prefill';

// Pre-filled answers (docs/specs/030-forms/forms.md "Filling in a form", blueprint §4a).

const Q = (
  id: string,
  type: FormQuestion['type'],
  extra: Partial<FormQuestion> = {},
): FormQuestion => ({
  id,
  type,
  prompt: id,
  ...extra,
});

const FORM = {
  sections: [
    {
      questions: [
        Q('name', 'short', { required: true }),
        Q('notes', 'paragraph'),
        Q('age', 'number', { whole: true, min: 1, max: 120 }),
        Q('mail', 'email'),
        Q('site', 'link'),
        Q('day', 'date'),
        Q('at', 'datetime'),
        Q('trip', 'daterange'),
        Q('tel', 'phone'),
        Q('team', 'single', { options: ['Red', 'Blue'], other: true }),
        Q('tags', 'multi', { options: ['A', 'B', 'C'], min: 2, max: 2, other: true }),
        Q('stars', 'rating', { scale: 5 }),
        Q('agree', 'checkbox', { required: true }),
      ],
    },
    { questions: [Q('later', 'short')] },
  ],
};

const read = (query: string) => readPrefill(FORM, query);

describe('readPrefill', () => {
  it('reads a valid answer of every type, as the checks keep it', () => {
    const q = new URLSearchParams();
    q.append('q.name', '  Ada ');
    q.append('q.notes', 'Line one');
    q.append('q.age', '36');
    q.append('q.mail', 'ada@example.com');
    q.append('q.site', 'example.com');
    q.append('q.day', '2026-11-13');
    q.append('q.at', '2026-11-13T09:30:00+00:00');
    q.append('q.trip', '2026-12-01');
    q.append('q.trip', '2026-12-05');
    q.append('q.tel', '+44 20 7946 0958');
    q.append('q.team', 'Blue');
    q.append('q.tags', 'C');
    q.append('q.tags', 'A');
    q.append('q.stars', '4');
    q.append('q.agree', 'yes');
    q.append('q.later', 'In section two');
    const out = readPrefill(FORM, q);
    expect(out).toMatchObject({
      name: 'Ada',
      notes: 'Line one',
      age: 36,
      mail: 'ada@example.com',
      site: 'https://example.com',
      day: '2026-11-13',
      trip: ['2026-12-01', '2026-12-05'],
      tel: '+44 20 7946 0958',
      team: 'Blue',
      tags: ['A', 'C'],
      stars: 4,
      agree: true,
      later: 'In section two',
    });
    expect(typeof out.at).toBe('string');
    // A string query reads the same.
    expect(read(q.toString())).toEqual(out);
    expect(read(`?${q.toString()}`)).toEqual(out);
  });

  it('ignores values their question refuses', () => {
    expect(
      read(
        [
          'q.name=' + 'x'.repeat(201),
          'q.age=12.5',
          'q.mail=not-an-email',
          'q.site=http://example.com',
          'q.day=2026-02-30',
          'q.at=tomorrow',
          'q.tel=call me',
          'q.team=Green',
          'q.tags=A&q.tags=B&q.tags=C',
          'q.stars=6',
          'q.agree=no',
        ].join('&'),
      ),
    ).toEqual({});
  });

  it('ignores ids the form does not have, and anything without the prefix', () => {
    expect(read('q.missing=1&name=Ada&utm_source=mail&q.=x')).toEqual({});
  });

  it('ignores a value of the wrong shape for its type', () => {
    // A Date Range needs both ends; a rating digits; a number a plain decimal.
    expect(read('q.trip=2026-12-01')).toEqual({});
    expect(read('q.trip=2026-12-05&q.trip=2026-12-01')).toEqual({});
    expect(read('q.trip=a&q.trip=b&q.trip=c')).toEqual({});
    expect(read('q.stars=four&q.age=0x1A&q.team=red')).toEqual({});
    expect(read('q.agree=')).toEqual({});
  });

  it('never fills an Other option, and keeps a Multiple Choice under its minimum', () => {
    expect(read(`q.team=${OTHER_ANSWER}`)).toEqual({});
    expect(read(`q.tags=${OTHER_ANSWER}&q.tags=B`)).toEqual({ tags: ['B'] });
    expect(read(`q.tags=${OTHER_ANSWER}`)).toEqual({});
  });

  it('takes the first value of a one-value question and ticks only on yes words', () => {
    expect(read('q.name=Ada&q.name=Grace')).toEqual({ name: 'Ada' });
    for (const yes of ['true', '1', 'YES', ' on ']) {
      expect(read(`q.agree=${encodeURIComponent(yes)}`)).toEqual({ agree: true });
    }
  });
});

describe('prefillSearch', () => {
  it('writes every answer readPrefill keeps, and reads back the same', () => {
    const answers = {
      name: 'Ada',
      age: '36',
      trip: ['2026-12-01', '2026-12-05'],
      tags: ['B', OTHER_ANSWER],
      stars: 4,
      agree: true,
      later: 'Two',
    };
    const search = prefillSearch(FORM, answers);
    expect(search).toBe(
      'q.name=Ada&q.age=36&q.trip=2026-12-01&q.trip=2026-12-05&q.tags=B&q.stars=4&q.agree=true&q.later=Two',
    );
    expect(read(search)).toEqual({
      name: 'Ada',
      age: 36,
      trip: ['2026-12-01', '2026-12-05'],
      tags: ['B'],
      stars: 4,
      agree: true,
      later: 'Two',
    });
  });

  it('leaves out empty, refused and Other answers', () => {
    expect(
      prefillSearch(FORM, {
        name: '  ',
        mail: 'nope',
        team: OTHER_ANSWER,
        agree: false,
        tags: [],
        unknown: 'x',
      }),
    ).toBe('');
  });

  it('encodes values that need it', () => {
    const search = prefillSearch(FORM, { notes: 'a&b=c ü' });
    expect(read(search)).toEqual({ notes: 'a&b=c ü' });
  });
});
