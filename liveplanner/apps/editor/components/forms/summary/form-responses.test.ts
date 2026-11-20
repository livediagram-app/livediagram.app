import { describe, expect, it } from 'vitest';
import type { FormDefinition } from '@liveplanner/forms';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import { cardResponses, summaryOffered } from './form-responses';

// A board form's responses, read back from its cards (docs/specs/030-forms/forms.md "The Summary").

const TYPES = [
  { id: 'task', label: 'Task', fields: ['title', 'description'] },
  {
    id: 'bug',
    label: 'Bug',
    fields: ['title', 'description', 'f-sev'],
    custom: [{ id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] }],
  },
] as unknown as ItemTypeDef[];

const FORM: FormDefinition = {
  v: 1,
  heading: 'Report',
  sections: [
    {
      id: 's',
      title: '',
      questions: [
        { id: 'q-name', type: 'short', prompt: 'Name', goesTo: { to: 'title' } },
        { id: 'q-sev', type: 'single', prompt: 'Severity', options: ['Low', 'High'] },
      ],
    },
  ],
  destination: {
    tabId: 'board',
    typeId: 'task',
    status: 'new',
    typeRules: [
      {
        id: 'r',
        questionId: 'q-sev',
        anyOf: ['High'],
        typeId: 'bug',
        status: 'new',
        fields: { 'q-sev': 'f-sev' },
      },
    ],
  },
};

const card = (id: string, type: string, fields: Item['fields']) => ({ id, type, fields }) as Item;

describe('cardResponses', () => {
  it("reads this form's cards alone, oldest first, a rule's card where its rule put the answers", () => {
    const items = [
      card('c', 'bug', { title: 'Cy', 'f-sev': 'High', fromForm: 'form:3' }),
      card('a', 'task', { title: 'Ada', description: 'Severity\nLow', fromForm: 'form:1' }),
      card('x', 'task', { title: 'Another form', fromForm: 'other:1' }),
      card('y', 'task', { title: 'Typed by hand' }),
      card('g', 'gone', { title: 'Its type was deleted', fromForm: 'form:2' }),
    ];
    const read = cardResponses(FORM, 'form', items, TYPES).map((r) => [...r]);
    expect(read).toEqual([
      [
        ['q-name', 'Ada'],
        ['q-sev', 'Low'],
      ],
      [['q-name', 'Its type was deleted']],
      [
        ['q-name', 'Cy'],
        ['q-sev', 'High'],
      ],
    ]);
  });

  it('reads none from a project with no responses', () => {
    expect(cardResponses({ ...FORM, destination: undefined }, 'form', [], TYPES)).toEqual([]);
  });
});

// The Summary changes nothing, so it is gated on reach, not on role: an Editor's, a Participant's and a Viewer's
// session all come here with `tabScope` null and are offered it alike.
describe('summaryOffered', () => {
  it('is there for every role once responses have somewhere to go', () => {
    expect(summaryOffered({ id: 'board' }, null)).toBe(true);
  });
  it('is not there while responses go nowhere, nor through a link to this one tab', () => {
    expect(summaryOffered(null, null)).toBe(false);
    expect(summaryOffered(undefined, null)).toBe(false);
    expect(summaryOffered({ id: 'board' }, 'form-tab')).toBe(false);
  });
});
