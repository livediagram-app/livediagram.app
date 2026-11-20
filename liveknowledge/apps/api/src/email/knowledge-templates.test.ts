import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import * as templates from './knowledge-templates';
import {
  EMAIL_PAGES_LISTED,
  pagesDisagreeEmail,
  remindOwnersEmail,
  reviewDueEmail,
} from './knowledge-templates';

// The Knowledgebase Reviews emails (docs/specs/030-knowledgebase/verification.md "Reminders"): pinned by hash like
// every other email this api sends (templates-golden.test.ts), and held to what they must never do with other
// people's text. Re-record a hash (RECORD_EMAIL_HASHES=1 prints them) only for a change that is meant.
const recording = () =>
  !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
    .RECORD_EMAIL_HASHES;

const ENVS = [{}, { APP_BASE_URL: 'https://www.example.app/' }] as unknown as Env[];
const KB = { id: 'k b', name: 'Hand<book> & "Co"' };
const HOSTILE = '<script>alert(1)</script> & "quoted" \'single\'';
const CONFLICT = {
  question: `When do we <b>deploy</b>?\nSecond line`,
  a: { tab: 'a/1', title: 'Deploys <i>', text: `On Tuesdays. ${HOSTILE}` },
  b: { tab: 'b 2', title: '', text: 'word '.repeat(200) },
};

const FIXTURES: Record<string, unknown[][]> = {
  reviewDueEmail: [
    [KB, [{ tab: 't1', title: 'One <b>' }]],
    [
      { id: 'x', name: ' ' },
      [
        { tab: 't1', title: '' },
        { tab: 't 2', title: 'Two & Three' },
      ],
    ],
    [KB, Array.from({ length: 130 }, (_, i) => ({ tab: `t${i}`, title: `Page ${i}` }))],
    // The knowledgebase's own Review Period, said in the email.
    [{ ...KB, knowledgeSettings: { reviewEvery: 365 } }, [{ tab: 't1', title: 'Yearly' }]],
    [{ ...KB, knowledgeSettings: { reviewEvery: 30 } }, [{ tab: 't1', title: 'Monthly' }]],
  ],
  remindOwnersEmail: [
    [KB, [{ tab: 't1', title: 'One <b>', state: 'review-due' }]],
    [
      { id: 'x', name: '' },
      [
        { tab: 't1', title: 'Due', state: 'review-due' },
        { tab: 't2', title: 'Never', state: 'never-verified' },
      ],
    ],
    // Under Never no page comes due, and the email says nothing of a period.
    [
      { ...KB, knowledgeSettings: { reviewEvery: 'never' } },
      [{ tab: 't2', title: 'Never', state: 'never-verified' }],
    ],
    [{ ...KB, knowledgeSettings: { reviewEvery: 180 } }, [{ tab: 't1', title: 'Due' }]],
  ],
  pagesDisagreeEmail: [[KB, CONFLICT]],
};

const EXPECTED: Record<string, string> = {
  pagesDisagreeEmail: 'a8c37a3b46ed8cec3632fd636a2589c64e3a336d74fefb19965dd55d30315014',
  remindOwnersEmail: '2543a86f52503a6df8ab3cc79b72185c99e349bc00a221b0f6c872042071affe',
  reviewDueEmail: '77e3d091b74e39c42447e8cd13a64455d902b5dc5e6aee3a76b6aadb0b832c69',
};

function renders(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(templates)) {
    if (typeof value !== 'function') continue;
    const cases = FIXTURES[name];
    if (!cases) throw new Error(`no fixtures for ${name}`);
    const fn = value as (...args: unknown[]) => unknown;
    const results = ENVS.flatMap((env) => cases.map((args) => fn(env, ...args)));
    out[name] = createHash('sha256').update(JSON.stringify(results)).digest('hex');
  }
  return out;
}

describe('the Knowledgebase Reviews emails stay byte-identical', () => {
  it('matches every pinned hash', () => {
    if (recording()) console.log(`HASHES liveknowledge reviews ${JSON.stringify(renders())}`);
    expect(renders()).toEqual(EXPECTED);
  });
});

describe('what they do with other people’s text', () => {
  const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;
  const all = [
    reviewDueEmail(env, { id: 'kb', name: HOSTILE }, [{ tab: 't"1', title: HOSTILE }]),
    remindOwnersEmail(env, { id: 'kb', name: HOSTILE }, [
      { tab: 't1', title: HOSTILE, state: 'never-verified' },
    ]),
    pagesDisagreeEmail(
      env,
      { id: 'kb', name: HOSTILE },
      {
        question: HOSTILE,
        a: { tab: 't1', title: HOSTILE, text: HOSTILE },
        b: { tab: 't2', title: 'B', text: 'b' },
      },
    ),
  ];

  it('escapes names, titles, questions and passages in the HTML', () => {
    for (const email of all) {
      expect(email.html).not.toContain('<script>');
      expect(email.html).toContain(
        '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quoted&quot;',
      );
    }
    // A page id never closes its link's attribute.
    expect(all[0]!.html).toContain('#t=t%221');
  });

  it('carries a Title Case subject on one line, a text alternative and the settings link', () => {
    const subjects = [
      reviewDueEmail(env, { id: 'kb', name: 'Hand\nbook' }, [{ tab: 't', title: 'T' }]).subject,
      remindOwnersEmail(env, { id: 'kb', name: 'Handbook' }, []).subject,
      pagesDisagreeEmail(env, { id: 'kb', name: '' }, CONFLICT).subject,
    ];
    expect(subjects).toEqual([
      'Pages Due for Review in Hand book',
      'Pages to Review in Handbook',
      'Two Pages Disagree in a knowledgebase',
    ]);
    for (const email of all) {
      expect(email.text).toContain(
        'Turn these emails off: https://app.test/explorer?settings=notifications',
      );
      expect(email.text).not.toContain('<strong>');
      expect(email.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
      expect(email.html).toContain('Manage your notifications');
    }
  });

  it('quotes a passage as one line of at most 280 characters', () => {
    const { html, text } = pagesDisagreeEmail(env, { id: 'kb', name: 'K' }, CONFLICT);
    const quote = /says: “([^”]*)”/g;
    const quotes = [...html.matchAll(quote)].map((m) => m[1]!);
    expect(quotes).toHaveLength(2);
    expect(quotes[1]!.length).toBeLessThanOrEqual(281);
    expect(quotes[1]!.endsWith('…')).toBe(true);
    expect(text).toContain('When do we <b>deploy</b>? Second line');
  });

  it(`lists ${EMAIL_PAGES_LISTED} pages and counts the rest, so 500 pages stay under Gmail's 102 KB`, () => {
    const pages = Array.from({ length: 500 }, (_, i) => ({
      tab: crypto.randomUUID(),
      title: `A Page With a Fairly Long Title, Number ${i}`,
      state: 'review-due' as const,
    }));
    for (const email of [
      reviewDueEmail(env, { id: crypto.randomUUID(), name: 'Handbook' }, pages),
      remindOwnersEmail(env, { id: crypto.randomUUID(), name: 'Handbook' }, pages),
    ]) {
      expect(email.html.match(/<li /g)).toHaveLength(EMAIL_PAGES_LISTED + 1);
      expect(email.html).toContain('And 400 pages more.');
      expect(new TextEncoder().encode(email.html).length).toBeLessThan(60_000);
    }
  });
});

describe("the knowledgebase's Review Period in the emails", () => {
  const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;
  const page = [{ tab: 't1', title: 'One' }];
  const kb = (reviewEvery?: 30 | 90 | 180 | 365 | 'never') => ({
    id: 'kb',
    name: 'Handbook',
    ...(reviewEvery ? { knowledgeSettings: { reviewEvery } } : {}),
  });

  it('says the period once, in the HTML and the text, every 90 days when none is stored', () => {
    for (const email of [reviewDueEmail, remindOwnersEmail]) {
      for (const [every, words] of [
        [undefined, 'every 90 days'],
        [30, 'every 30 days'],
        [180, 'every 180 days'],
        [365, 'every year'],
      ] as const) {
        const line = `This knowledgebase reviews pages ${words}.`;
        const sent = email(env, kb(every), page);
        expect(sent.html.split(line)).toHaveLength(2);
        expect((sent.text ?? '').split(line)).toHaveLength(2);
      }
    }
  });

  it('says nothing of a period under Never', () => {
    const sent = remindOwnersEmail(env, kb('never'), page);
    expect(sent.html).not.toContain('reviews pages');
    expect(sent.text).not.toContain('reviews pages');
    expect(sent.html).toContain('Verify a page that is right, and fix one that is not.');
  });
});
