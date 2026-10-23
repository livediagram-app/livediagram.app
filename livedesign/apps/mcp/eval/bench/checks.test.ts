import { describe, expect, it } from 'vitest';
import { atLeast, find, mentionsAll, pagesOf, runChecks } from './checks.mjs';
import { parseTabHeader } from './snapshot.mjs';

const text = (id: string, label: string) => ({
  id,
  type: 'text',
  label,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
});

const screens = {
  designs: [
    {
      id: 'd1',
      name: 'Coffee app',
      tabs: [
        {
          id: 't1',
          name: 'Onboarding',
          elements: [
            text('a', 'Welcome'),
            text('b', 'Pick your roast'),
            {
              id: 'c',
              type: 'shape',
              shape: 'square',
              label: 'Sign up',
              x: 0,
              y: 60,
              width: 120,
              height: 40,
            },
          ],
        },
      ],
    },
  ],
};

describe('readers', () => {
  it('finds the elements whose words match', () => {
    expect(find(screens, /roast/i).map((e: { id: string }) => e.id)).toEqual(['b']);
  });

  it('names what is missing, and counts against a floor', () => {
    expect(mentionsAll(screens, [/welcome/i, /payment/i])).toEqual({
      pass: false,
      detail: 'missing: payment',
    });
    expect(mentionsAll(screens, [/coffee/i, /sign up/i]).pass).toBe(true);
    expect(atLeast(5, 3, 'screens')).toEqual({ pass: false, detail: '3 screens, wanted 5+' });
  });
});

describe('pagesOf', () => {
  it('reads every kind of page line', () => {
    const pages = [
      'page 1 page-1 · wireframe iPhone · at -960,-540 1920x1080 · 3 elements',
      'page 2 "Tip 2" page-99 · blank A4 · at 636,-540 794x1123 · 16 elements',
      'page 3 "Badge" page-3 · logo 1024 x 1024 · at -512,-512 1024x1024 · background #fdf3e3 · 5 elements',
    ].join('\n');
    const snap = { designs: [{ id: 'd', tabs: [{ id: 't', elements: [], pages }] }] };
    expect(pagesOf(snap)).toEqual([
      {
        tabId: 't',
        n: 1,
        name: null,
        kind: 'wireframe',
        format: 'iPhone',
        x: -960,
        y: -540,
        width: 1920,
        height: 1080,
        elements: 3,
      },
      {
        tabId: 't',
        n: 2,
        name: 'Tip 2',
        kind: 'blank',
        format: 'A4',
        x: 636,
        y: -540,
        width: 794,
        height: 1123,
        elements: 16,
      },
      {
        tabId: 't',
        n: 3,
        name: 'Badge',
        kind: 'logo',
        format: '1024 x 1024',
        x: -512,
        y: -512,
        width: 1024,
        height: 1024,
        elements: 5,
      },
    ]);
  });
});

describe('parseTabHeader', () => {
  it('reads a tab’s pages', () => {
    expect(
      parseTabHeader(
        'tab 3be5 "Flow" · 53 elements: 53 boxes · 6 pages: 5 wireframe, 1 logo (view pages) · rev 5',
      ),
    ).toEqual({
      pageCount: 6,
      pageKinds: { wireframe: 5, logo: 1 },
    });
  });
});

describe('runChecks', () => {
  it('adds the base checks, keeps a reason and fails a check that throws', () => {
    const task = {
      checks: [
        ['has a welcome', ({ snap }: { snap: typeof screens }) => mentionsAll(snap, [/welcome/i])],
        [
          'throws',
          () => {
            throw new Error('boom');
          },
        ],
      ],
    };
    expect(runChecks(task, { snap: screens, run: { finalText: 'Done' } })).toEqual([
      { name: 'made something', pass: true, detail: null },
      { name: 'replied', pass: true, detail: null },
      { name: 'has a welcome', pass: true, detail: null },
      { name: 'throws', pass: false, detail: 'check threw: boom' },
    ]);
    expect(
      runChecks({ checks: [] }, { snap: { designs: [] }, run: { finalText: ' ' } }).map(
        (c: { pass: boolean }) => c.pass,
      ),
    ).toEqual([false, false]);
  });
});
