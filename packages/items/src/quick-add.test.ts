import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quick-add';
import { ITEM_TYPES } from './item-types';
import { ALI, SAM } from './test-items';

describe('parseQuickAdd', () => {
  it('reads every token and leaves the title', () => {
    const r = parseQuickAdd('note: Login fails on Safari @sam #auth #web !high ~3', [SAM, ALI]);
    expect(r.title).toBe('Login fails on Safari');
    expect(r.type).toBe('note');
    expect(r.fields).toEqual({
      assignee: SAM,
      labels: ['auth', 'web'],
      priority: 'high',
      estimate: 3,
    });
    expect(r.tokens.map((t) => t.kind)).toEqual([
      'type',
      'assignee',
      'label',
      'label',
      'priority',
      'estimate',
    ]);
  });

  it('keeps tokens that do not resolve', () => {
    const r = parseQuickAdd('Ship #1 to @nobody !soon dinner: later', [SAM]);
    expect(r.title).toBe('Ship #1 to @nobody !soon dinner: later');
    expect(r.type).toBeUndefined();
    expect(r.fields).toEqual({});
  });

  it('matches people by full name, first name, or prefix; only one assignee', () => {
    expect(parseQuickAdd('a @Sam', [SAM]).fields['assignee']).toEqual(SAM);
    expect(parseQuickAdd('a @al', [SAM, ALI]).fields['assignee']).toEqual(ALI);
    const two = parseQuickAdd('a @sam @ali', [SAM, ALI]);
    expect(two.fields['assignee']).toEqual(SAM);
    expect(two.title).toBe('a @ali');
  });

  it('reads a plural type name and caps the estimate', () => {
    const r = parseQuickAdd('Ideas: more ~5000', []);
    expect(r.type).toBe('idea');
    expect(r.fields['estimate']).toBe(999);
    expect(r.title).toBe('more');
  });
});

// docs/specs/025-plan/item-types.md "Where types show".
describe('quick add with a document type', () => {
  it('reads a leading name with spaces as a type, and leaves other colons alone', () => {
    const types = [
      ...ITEM_TYPES,
      {
        id: 'customer-call',
        label: 'Customer call',
        newTitle: 'x',
        glyph: 'chat',
        color: '#000000',
        fields: [],
      },
    ];
    expect(parseQuickAdd('Customer call: Acme renewal', [], types)).toMatchObject({
      type: 'customer-call',
      title: 'Acme renewal',
    });
    expect(parseQuickAdd('Fix login: on Safari', [], types).type).toBeUndefined();
  });
});
