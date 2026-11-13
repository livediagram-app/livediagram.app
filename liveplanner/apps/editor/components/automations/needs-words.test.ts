import { describe, expect, it } from 'vitest';
import { needsWords } from './needs-words';

// docs/specs/026-plan/automations.md "Conditions": the Needs Attention line never shows an id.
describe('needsWords', () => {
  it('says each kind gone once, in the order the rule names them', () => {
    expect(
      needsWords([
        { kind: 'column', id: 'review~wt6t' },
        { kind: 'person', id: 'user_1' },
        { kind: 'field', id: 'f-1' },
        { kind: 'card', id: 'WLi83SXFCXaW' },
      ]),
    ).toBe('A column is gone · Someone is gone · A field is gone · A card is gone');
  });

  it('counts several of a kind', () => {
    expect(
      needsWords([
        { kind: 'column', id: 'a' },
        { kind: 'type', id: 't' },
        { kind: 'column', id: 'b' },
        { kind: 'person', id: 'p1' },
        { kind: 'person', id: 'p2' },
      ]),
    ).toBe('2 columns are gone · A card type is gone · 2 people are gone');
  });

  it('words every kind, and keeps a field Field Changed never hears by its name', () => {
    expect(
      needsWords([
        { kind: 'filter', id: 't/x' },
        { kind: 'form', id: 'f' },
        { kind: 'webhook', id: 'w' },
        { kind: 'unheard', name: 'Time Spent' },
      ]),
    ).toBe(
      'A saved filter is gone · A Form tab is gone · A webhook is gone · Field Changed never hears Time Spent',
    );
    expect(needsWords([])).toBe('');
  });
});
