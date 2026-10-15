import { describe, expect, it } from 'vitest';
import { DEFAULT_CLOSED_MESSAGE, DEFAULT_CONFIRMATION } from './limits';
import type { FormDefinition } from './model';
import { closedMessageOf, closedReason, publicForm } from './public';
import {
  QUESTION_TYPE_NAMES,
  QUESTION_TYPE_TELEMETRY,
  QUESTION_TYPES,
  isQuestionType,
  promptOf,
} from './model';

const form: FormDefinition = {
  v: 1,
  heading: 'Bugs',
  description: 'Tell us',
  accent: '#dc2626',
  cover: { color: '#000000' },
  sections: [
    {
      id: 's-1',
      title: '',
      description: 'd',
      questions: [{ id: 'q-1', type: 'short', prompt: 'Name', goesTo: { to: 'title' } }],
    },
    { id: 's-2', title: 'More', questions: [] },
  ],
  destination: { tabId: 't', typeId: 'bug', status: 's' },
  starter: 'bug-report',
  confirmation: 'Ta',
};

describe('publicForm', () => {
  it('shows the form without where its answers go', () => {
    const p = publicForm(form);
    expect(p).toEqual({
      heading: 'Bugs',
      description: 'Tell us',
      accent: '#dc2626',
      cover: { color: '#000000' },
      sections: [
        {
          id: 's-1',
          title: '',
          description: 'd',
          questions: [{ id: 'q-1', type: 'short', prompt: 'Name' }],
        },
        { id: 's-2', title: 'More', questions: [] },
      ],
      confirmation: 'Ta',
    });
    expect(JSON.stringify(p)).not.toMatch(/destination|goesTo|starter/);
  });

  it('gives the default confirmation', () => {
    expect(publicForm({ v: 1, heading: 'X', sections: [] }).confirmation).toBe(
      DEFAULT_CONFIRMATION,
    );
  });
});

describe('closed', () => {
  const open = { open: true, responses: 0, now: 100 };

  it('says why a form is closed', () => {
    expect(closedReason(form, open)).toBeNull();
    expect(closedReason(form, { ...open, open: false })).toBe('switched_off');
    expect(closedReason({ ...form, destination: undefined }, open)).toBe('no_destination');
    expect(closedReason({ ...form, closesAt: 100 }, open)).toBe('closes_at');
    expect(closedReason({ ...form, closesAt: 101 }, open)).toBeNull();
    expect(closedReason({ ...form, limit: 3 }, { ...open, responses: 3 })).toBe('limit');
  });

  it('has a closed message', () => {
    expect(closedMessageOf({})).toBe(DEFAULT_CLOSED_MESSAGE);
    expect(closedMessageOf({ closedMessage: 'Bye' })).toBe('Bye');
  });
});

describe('the model', () => {
  it('names every type', () => {
    for (const t of QUESTION_TYPES) {
      expect(QUESTION_TYPE_NAMES[t]).toBeTruthy();
      expect(QUESTION_TYPE_TELEMETRY[t]).toMatch(/^[A-Z][A-Za-z]+$/);
      expect(isQuestionType(t)).toBe(true);
    }
    expect(isQuestionType('essay')).toBe(false);
  });

  it('reads a blank prompt as Untitled Question', () => {
    expect(promptOf({ prompt: '  ' })).toBe('Untitled Question');
    expect(promptOf({ prompt: 'Hi' })).toBe('Hi');
  });
});
