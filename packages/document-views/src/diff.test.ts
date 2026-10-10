import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { checkoutTab } from './__fixtures__/checkout-tab';
import { CHECKOUT_AFTER_REV, checkoutTabAfter } from './__fixtures__/checkout-tab-after';
import { golden } from './__fixtures__/golden-path';
import { diffView } from './diff';

const tabOf = (elements: Element[]): Tab => ({ id: 'tab-1', name: 'T', elements });
const changeLines = (before: Element[], after: Element[]) =>
  diffView(tabOf(before), tabOf(after), { since: 1, rev: 2 }).text.split('\n').slice(1);

describe('diffView (R17, VW36)', () => {
  it("reads the checkout tab's six changes like the outline", async () => {
    const { text, json } = diffView(checkoutTab(), checkoutTabAfter(), {
      since: 41,
      rev: CHECKOUT_AFTER_REV,
    });
    await expect(text).toMatchFileSnapshot(golden('checkout.diff.txt'));
    expect(json.since).toBe(41);
    expect(json.header.rev).toBe(47);
    expect(json.changes.map((c) => c.op)).toEqual(['-', '~', '~', '~', '+', '+']);
    expect(json.changes[1]!.changes).toEqual([
      { field: 'label', before: 'Payments service', after: 'Payments' },
    ]);
  });

  // An added id sharing a 4-character prefix lengthens refs (0bcd → 0bcd1): nothing else changed, and the diff
  // compares ids, so it says only what was added.
  it('reports only the added element when its id lengthens other refs', () => {
    const frame = shapeAt('frame', '0bcd1111-x', 0, 0, 500, 500, { label: 'F' });
    const inside = shapeAt('square', 'n1', 10, 10, 100, 50, { label: 'In' });
    const target = shapeAt('square', 'n2', 600, 0, 100, 50, { label: 'Out' });
    const arrow = arrowBetween('a1', '0bcd1111-x', 'n2');
    const added = shapeAt('square', '0bcd2222-x', 900, 0, 100, 50, { label: 'New' });
    expect(
      changeLines([frame, inside, target, arrow], [frame, inside, target, arrow, added]),
    ).toEqual(['+ square 0bcd2 "New"']);
  });

  it('says 0 changes for the same tab', () => {
    expect(diffView(checkoutTab(), checkoutTab(), { since: 41, rev: 41 }).text).toBe(
      'tab 0b34 "Checkout platform" · since rev 41 · rev 41 · 0 changes',
    );
  });

  it('names kind, label, note, container, summary and attribute changes', () => {
    const frame = shapeAt('frame', 'f', 0, 0, 500, 500, { label: undefined });
    const a = shapeAt('square', 'a', 10, 10, 100, 50, { label: 'A', note: 'n' });
    const b = shapeAt('checklist', 'b', 10, 100, 100, 50, {
      checklistItems: [{ text: 'x', done: false }],
    });
    const c = shapeAt('square', 'c', 600, 0, 100, 50, { note: 'old' });
    const d = shapeAt('estimate', 'd', 700, 0, 100, 50, { responses: [] });
    expect(
      changeLines(
        [frame, a, b, c, d],
        [
          frame,
          { ...a, shape: 'circle', label: undefined, note: undefined, x: 900 },
          { ...b, checklistItems: [{ text: 'x', done: true }] },
          { ...c, note: 'new', locked: true, label: 'C' },
          { ...d, responses: [{ participantId: 'p', value: '3', at: 0 }], responsesRevealed: true },
        ],
      ),
    ).toEqual([
      '~ circle a kind square → circle · label "A" → none · note removed · in f → canvas · moved +890,+0',
      '~ checklist b done=0/1 → done=1/1',
      '~ square c label none → "C" · note changed · locked none → on',
      '~ estimate d votes 0 → 1 · revealed none → on',
    ]);
    expect(
      changeLines(
        [shapeAt('square', 'n', 0, 0)],
        [shapeAt('square', 'n', 0, 0, 100, 50, { note: 'hi' })],
      ),
    ).toEqual(['~ square n note added']);
  });

  it('names arrow ends, size, rotation, style and other fields', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((id, i) => shapeAt('square', id, i * 200, 0));
    const ab = arrowBetween('ab', 'a', 'b');
    expect(
      changeLines(
        [a!, b!, c!, ab],
        [
          { ...a!, width: 120, height: 40, rotation: 15 },
          { ...b!, fillColor: '#fff' },
          { ...c!, padding: 'lg', opacity: 0.5 },
          {
            ...ab,
            from: { kind: 'pinned', elementId: 'c', anchor: 'e' },
            to: { kind: 'free', x: 1, y: 1 },
          },
        ],
      ),
    ).toEqual([
      '~ square a resized +20,-10 · rotated',
      '~ square b restyled',
      '~ square c +2 other fields',
      '~ arrow ab from a → c · to b → free',
    ]);
    expect(changeLines([a!], [{ ...a!, opacity: 0.5 }])).toEqual(['~ square a +1 other field']);
    expect(changeLines([a!], [{ ...a!, shape: 'code-block' }])).toEqual([
      '~ code-block a kind square → code-block · none → lang=plain lines=0',
    ]);
    expect(changeLines([{ ...a!, shape: 'code-block' }], [a!])).toEqual([
      '~ square a kind code-block → square · lang=plain lines=0 → none',
    ]);
  });

  it('names an end moved from one arrow to another, and not one sliding along the same arrow', () => {
    const [a, b] = ['a', 'b'].map((id, i) => shapeAt('square', id, i * 200, 0));
    const [ab, ba] = [arrowBetween('ab', 'a', 'b'), arrowBetween('ba', 'b', 'a')];
    const rides = {
      ...arrowBetween('r', 'a', 'a'),
      to: { kind: 'on-arrow' as const, arrowId: 'ab', t: 0.5 },
    };
    const before = [a!, b!, ab, ba, rides];
    expect(
      changeLines(before, [a!, b!, ab, ba, { ...rides, to: { ...rides.to, t: 0.2 } }]),
    ).toEqual(['~ arrow r +1 other field']);
    expect(
      changeLines(before, [a!, b!, ab, ba, { ...rides, to: { ...rides.to, arrowId: 'ba' } }]),
    ).toEqual(['~ arrow r to arrow:ab → arrow:ba']);
  });

  // A card's id moves with its card: the ideas count speaks for both, no "other field".
  it('reads an idea with its card id as one change to the ideas', () => {
    const box = { ...shapeAt('idea-box', 'i', 0, 0), ideaCards: ['a'] } as Element;
    const lines = changeLines(
      [box],
      [{ ...box, ideaCards: ['a', 'b'], ideaCardIds: ['', 'x'] } as Element],
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('other field');
  });

  it('lists removals in the before order and additions under an unlabelled container', () => {
    const frame = shapeAt('frame', 'f', 0, 0, 500, 500, { label: undefined });
    const gone = shapeAt('square', 'gone', 600, 0, 100, 50, { label: 'Gone' });
    const odd = { id: 'odd', type: 'hologram' } as unknown as Element;
    expect(
      changeLines(
        [frame, gone, odd],
        [frame, shapeAt('square', 'new', 10, 10), { ...odd, label: 'x' } as Element],
      ),
    ).toEqual(['- square gone "Gone"', '+ square new in f', '~ ? hologram odd label none → "x"']);
    expect(changeLines([], [shapeAt('square', 'top', 0, 0, 100, 50, { label: 'Top' })])).toEqual([
      '+ square top "Top"',
    ]);
  });

  it('fits a budget and keeps JSON in step', () => {
    const { text, json } = diffView(
      checkoutTab(),
      checkoutTabAfter(),
      { since: 41, rev: 47 },
      { budget: 40, door: 'mcp' },
    );
    expect(text.split('\n').at(-1)).toMatch(
      /^… \d changes? hidden: read_document \{"budget":\d+\}$/,
    );
    expect(json.changes.length).toBeLessThan(6);
  });
});
