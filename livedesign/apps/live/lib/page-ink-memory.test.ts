import { describe, expect, it } from 'vitest';
import type { InkMemory } from '@livedesign/document';
import { pageInkMemory, rememberPageInk } from './page-ink-memory';

// docs/specs/007-editor/pages-mode.md "Re-inking", "Going back": a session memory per tab,
// bounded.
const one = (id: string): InkMemory =>
  new Map([[id, { textColor: { from: '#000000', to: '#ffffff' } }]]);

describe('page ink memory', () => {
  it('remembers per tab and forgets an empty memory', () => {
    expect(pageInkMemory('m-a').size).toBe(0);
    rememberPageInk('m-a', one('x'));
    expect(pageInkMemory('m-a').get('x')?.textColor?.from).toBe('#000000');
    expect(pageInkMemory('m-b').size).toBe(0);
    rememberPageInk('m-a', new Map());
    expect(pageInkMemory('m-a').size).toBe(0);
  });

  it('keeps at most twenty tabs, the least recently re-inked going first', () => {
    for (let i = 0; i < 21; i += 1) rememberPageInk(`cap-${i}`, one('x'));
    expect(pageInkMemory('cap-0').size).toBe(0);
    expect(pageInkMemory('cap-1').size).toBe(1);
    expect(pageInkMemory('cap-20').size).toBe(1);
  });
});
