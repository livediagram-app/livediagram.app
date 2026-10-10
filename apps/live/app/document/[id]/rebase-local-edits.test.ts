import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { rebaseLocalEdits } from './rebase-local-edits';

// docs/specs/012-collaboration/resync-without-reload.md "Unsaved edits": a resync keeps what was not saved yet.
const el = (id: string, x = 0): Element =>
  ({ id, type: 'text', x, y: 0, width: 10, height: 10, label: id }) as Element;
const tab = (els: Element[], extra: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements: els, ...extra }) as Tab;

describe('rebaseLocalEdits', () => {
  it("puts this editor's unsaved edits on top of the server's copy, keeping the peer's", () => {
    const baseline = tab([el('mine'), el('gone'), el('theirs')]);
    // Offline here: moved one, deleted one, added one.
    const screen = tab([el('mine', 50), el('theirs'), el('new')]);
    // Meanwhile a peer moved theirs and added another.
    const fetched = tab([el('mine'), el('gone'), el('theirs', 9), el('peer')]);
    const out = rebaseLocalEdits(fetched, screen, baseline);
    expect(out.elements.map((e) => [e.id, (e as { x: number }).x])).toEqual([
      ['mine', 50],
      ['theirs', 9],
      ['peer', 0],
      ['new', 0],
    ]);
  });

  it('counts a peer op that made new but equal objects as no edit, and keeps tab fields changed here', () => {
    const baseline = tab([el('a')], { theme: 'ocean' });
    const screen = tab([{ ...el('a') }], { theme: 'forest' });
    const fetched = tab([el('a', 7)], { theme: 'ocean' });
    const out = rebaseLocalEdits(fetched, screen, baseline);
    expect((out.elements[0] as { x: number }).x).toBe(7);
    expect(out.theme).toBe('forest');
  });

  it('is the fetched copy when nothing here is unsaved', () => {
    const baseline = tab([el('a')]);
    const fetched = tab([el('a', 3)]);
    expect(rebaseLocalEdits(fetched, tab([el('a')]), baseline)).toBe(fetched);
  });
});
