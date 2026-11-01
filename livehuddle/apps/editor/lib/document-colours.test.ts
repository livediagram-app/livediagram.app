import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { YOUR_COLOURS_MAX, documentColours } from './document-colours';

// docs/specs/004-interface-design/colour-picker.md "Custom colours"
type T = Pick<Tab, 'id' | 'customColours'> & Partial<Tab>;
const tab = (id: string, customColours?: string[], rest: Partial<Tab> = {}): T => ({
  id,
  customColours,
  ...rest,
});

describe('documentColours', () => {
  it('lists the colours picked with +, the first tab’s first, then the others in tab order, deduped', () => {
    const tabs = [tab('a', ['#111111', '#222222']), tab('b', ['#333333', '#111111'])];
    expect(documentColours(tabs)).toEqual(['#111111', '#222222', '#333333']);
    expect(documentColours(tabs, [], 'b')).toEqual(['#333333', '#111111', '#222222']);
  });

  it('never counts a colour an element holds: a template’s or theme’s hexes are not picks', () => {
    const tabs = [
      tab('a', undefined, {
        elements: [{ fillColor: '#fee2e2', strokeColor: '#dc2626' }] as unknown as Tab['elements'],
      }),
    ];
    expect(documentColours(tabs)).toEqual([]);
  });

  it('leaves out offered colours and anything not a #rrggbb, lower-casing the rest', () => {
    const tabs = [tab('a', ['#ABCDEF', 'transparent', '#abc', '#654321'])];
    expect(documentColours(tabs, ['#654321'])).toEqual(['#abcdef']);
  });

  it(`stops at ${YOUR_COLOURS_MAX}`, () => {
    const many = (from: number) =>
      Array.from({ length: 10 }, (_, i) => `#0000${(from + i).toString(16).padStart(2, '0')}`);
    const tabs = [tab('a', many(16)), tab('b', many(48))];
    expect(documentColours(tabs)).toHaveLength(YOUR_COLOURS_MAX);
  });
});
