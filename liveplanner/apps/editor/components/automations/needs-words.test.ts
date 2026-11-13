import { describe, expect, it } from 'vitest';
import { goneText, needsWords } from './needs-words';

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

// docs/specs/026-plan/automations.md "The Automations screen": the Audit Trail never shows an id either.
describe('goneText', () => {
  it('says a failed step’s gone thing as Needs Attention does, keeping a related card’s number', () => {
    expect(
      goneText('Field estimate_goneqa is gone', { kind: 'field', id: 'estimate_goneqa' }),
    ).toBe('A field is gone');
    expect(goneText('#12 Column qa is gone', { kind: 'column', id: 'qa' })).toBe(
      '#12 A column is gone',
    );
    expect(
      goneText('Failed on #12, #14: Card type epic~x is gone', { kind: 'type', id: 'epic~x' }),
    ).toBe('Failed on #12, #14: A card type is gone');
    expect(goneText('Nobody called "user_9" can be set', { kind: 'person', id: 'user_9' })).toBe(
      'Someone is gone',
    );
  });

  it('keeps a condition’s words, reading the id as the sentence reads a gone pick', () => {
    expect(goneText('Column is Done or qa (qa is gone)', { kind: 'column', id: 'qa' })).toBe(
      'Column is Done or a column no longer here (a column is gone)',
    );
    expect(
      goneText('Who Did It is user_1 (user_1 is gone)', { kind: 'person', id: 'user_1' }),
    ).toBe('Who Did It is Someone No Longer Here (someone is gone)');
    // Only the id as a whole word: a name that holds it stays.
    expect(goneText('Card Type is qa-two or qa (qa is gone)', { kind: 'type', id: 'qa' })).toBe(
      'Card Type is qa-two or a card type no longer here (a card type is gone)',
    );
    expect(goneText('Matches a Saved Filter (f.1 is gone)', { kind: 'filter', id: 'f.1' })).toBe(
      'Matches a Saved Filter (a saved filter is gone)',
    );
    expect(goneText('f-x is empty (f-x is gone)', { kind: 'field', id: 'f-x' })).toBe(
      'a field no longer here is empty (a field is gone)',
    );
  });

  it('reads a line from before, with no gone beside it, as stored', () => {
    expect(goneText('Field f-1 is gone', undefined)).toBe('Field f-1 is gone');
  });
});
