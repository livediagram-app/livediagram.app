import { describe, expect, it } from 'vitest';
import { createSticky, type Element } from '@livediagram/document';
import { CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { golden } from './__fixtures__/golden-path';
import { commentHosts, commentsView } from './comments';
import { buildViewModel } from './model';

const checkout = () => buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });

describe('commentsView (R17, R21, VW33)', () => {
  it('prints open threads in full and counts the resolved', async () => {
    const { text, json } = commentsView(checkout());
    await expect(text).toMatchFileSnapshot(golden('checkout.comments.txt'));
    expect(json.threads).toHaveLength(1);
    expect(json.elision).toMatchObject({ arguments: { all: true }, command: 'view --all' });
  });

  it('shows resolved threads with all', () => {
    const { text, json } = commentsView(checkout(), { all: true, door: 'mcp' });
    expect(text.split('\n')[1]).toBe('square e4a8 "Payments service" · resolved · 1');
    expect(json.threads.map((t) => t.resolved)).toEqual([true, false]);
    expect(json.elision).toBeNull();
  });

  it('never prints an author id', () => {
    expect(commentsView(checkout(), { all: true }).text).not.toMatch(/user_/);
  });

  it('keeps JSON in step with the lines a budget keeps', () => {
    const { text, json } = commentsView(checkout(), { all: true, budget: 60 });
    expect(text.split('\n').slice(1, -1)).toHaveLength(
      json.threads.reduce((n, t) => n + 1 + t.comments.length, 0),
    );
    expect(text.split('\n').at(-1)).toMatch(
      /^… (\d+ threads? hidden; )?\d+ comments? hidden: view --budget \d+$/,
    );
  });

  it('quotes a spaced author, marks a bad date and prints an unlabelled element', () => {
    const sticky = {
      ...createSticky(0, 0),
      id: 'note',
      label: '',
      commentThread: {
        comments: [
          {
            id: 'c',
            text: 'Hi',
            createdAt: Number.MAX_VALUE,
            authorName: 'Sam Lee',
            authorColor: '#000',
          },
          { id: 'd' },
        ],
        resolved: true,
      },
    } as unknown as Element;
    const model = buildViewModel({ id: 'tab-1', name: 'T', elements: [sticky] });
    expect(commentsView(model, { all: true }).text.split('\n').slice(1)).toEqual([
      'sticky note · resolved · 2',
      '  "Sam Lee" ?: "Hi"',
      '  "" 1970-01-01: ""',
    ]);
    expect(commentsView(model).text.split('\n').at(-1)).toBe(
      '… 1 resolved thread hidden: view --all',
    );
    const twice = buildViewModel({
      id: 'tab-1',
      name: 'T',
      elements: [sticky, { ...sticky, id: 'other' }],
    });
    expect(commentsView(twice).text.split('\n').at(-1)).toBe(
      '… 2 resolved threads hidden: view --all',
    );
  });
});

describe('commentHosts', () => {
  it('lists the elements holding a thread in the comments view’s order, with ref and label', () => {
    const model = checkout();
    const hosts = commentHosts(model);
    const view = commentsView(model, { all: true }).json.threads;
    expect(hosts.map((h) => h.ref)).toEqual(view.map((t) => t.ref));
    expect(hosts.map((h) => h.label)).toEqual(view.map((t) => t.label));
    expect(hosts.every((h) => model.refs.refOf(h.el.id) === h.ref)).toBe(true);
  });
});
