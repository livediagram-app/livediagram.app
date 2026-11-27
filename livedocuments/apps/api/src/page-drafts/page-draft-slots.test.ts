import { describe, expect, it } from 'vitest';
import { draftCatalogue } from './page-draft-asks';
import { isPlaceholder, slotRoles } from './page-draft-slots';

// docs/specs/007-editor/describe-a-page.md "Every kind": each slot told by its place on the page, and the words that
// only hold a place known, so they are never laid on a page.
describe('slot roles', () => {
  it('gives every slot of every layout a role, and most layouts a heading', () => {
    for (const kind of ['slide', 'infographic'] as const) {
      const catalogue = draftCatalogue(kind);
      for (const l of catalogue)
        for (const s of l.slots)
          if (s.slot) expect(l.roles.get(s.slot), `${l.id} ${s.slot}`).toBeTruthy();
      expect(catalogue.filter((l) => l.heading).length).toBeGreaterThan(catalogue.length * 0.8);
    }
    const roles = (['slide', 'infographic'] as const).flatMap((k) =>
      draftCatalogue(k).flatMap((l) => [...l.roles.values()]),
    );
    expect(roles.some((r) => r.startsWith('step '))).toBe(true);
    expect(roles.some((r) => r.startsWith('card '))).toBe(true);
  });

  it('tells a lone text by its third of the page, and a card with one text by its text', () => {
    const page = { x: 0, y: 0, width: 300, height: 300 };
    const size = () => 16;
    const els = [
      { id: 'h', type: 'text', x: 0, y: 0, width: 300, height: 20, label: 'Heading' },
      { id: 'n', type: 'text', x: 250, y: 280, width: 40, height: 10, label: 'Note' },
      { id: 'c', type: 'shape', shape: 'square', x: 0, y: 100, width: 100, height: 100 },
      { id: 't', type: 'text', x: 10, y: 110, width: 80, height: 20, label: 'In card' },
    ];
    const out = slotRoles(
      els,
      [
        { id: 'h', slot: 'title' },
        { id: 'n', slot: 'body[0]' },
        { id: 't', slot: 'body[1]' },
        { id: 'gone', slot: 'body[2]' },
        { id: 'x', slot: null },
      ],
      page,
      size,
    );
    expect(out.heading).toBe('title');
    expect(out.roles.get('body[0]')).toBe('a text at the bottom right of the page (16px)');
    expect(out.roles.get('body[1]')).toBe('card 1 of 1: its text (16px)');
    expect(slotRoles([], [], page, size)).toEqual({ roles: new Map(), heading: null });
  });
});

describe('isPlaceholder', () => {
  it('knows stand-ins, and leaves real words, links and tasks alone', () => {
    for (const t of [
      '[Insert number here]',
      'Example 1: [Insert first example here]',
      'N/A',
      'n/a',
      'TBD',
      'tbc',
      '...',
      '???',
      'XX%',
      'Lorem ipsum dolor',
      '{{name}}',
      'Please insert your name here',
      'placeholder text',
    ])
      expect(isPlaceholder(t), t).toBe(true);
    for (const t of [
      '',
      '12k',
      'None',
      'Not applicable to teams',
      '[the guide](https://x.example)',
      '[x] Done',
      '\u2014',
    ])
      expect(isPlaceholder(t), t).toBe(false);
  });
});
