import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { fixedIds, sprintDashboard } from './fixtures/sprint-dashboard';
import { applied, refused } from './fixtures/outcomes';
import { applyReplace } from './replace';
import type { ReplaceOptions } from './types';

// A replace's `form` source (docs/specs/030-forms/forms.md "Agents", blueprint forms.md §15).
const options: ReplaceOptions = { tabId: 'form-tab', name: 'Ignored', makeId: fixedIds() };
const form = {
  v: 1,
  heading: 'Party RSVP',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [{ id: 'q-1', type: 'short', prompt: 'Name', required: true }],
    },
  ],
};
const formTab = (): Tab => ({
  id: 'form-tab',
  name: 'Party RSVP',
  elements: [],
  kind: 'form',
  form: form as Tab['form'],
  theme: 'ocean',
});

describe('form replace', () => {
  it('makes a new Form tab named by its heading, always in Plan, in the theme asked', () => {
    const out = applied(applyReplace(null, { form }, { ...options, themeId: 'ocean' }));
    expect(out.tab).toMatchObject({
      id: 'form-tab',
      name: 'Party RSVP',
      kind: 'form',
      theme: 'ocean',
      elements: [],
    });
    expect(out.tab.form?.sections[0]?.questions[0]).toMatchObject({
      prompt: 'Name',
      required: true,
    });
  });

  it('stores the form as the editor reads it, dropping what is not a form’s', () => {
    const out = applied(
      applyReplace(null, { form: { ...form, accent: '#ff0000', junk: 1 } }, options),
    );
    expect(out.tab.form).not.toHaveProperty('accent');
    expect(out.tab.form).not.toHaveProperty('junk');
  });

  it('refuses what is not a form', () => {
    const out = refused(applyReplace(null, { form: 'a form' }, options));
    expect(out).toMatchObject({ code: 'invalid_value' });
    expect(out.details[0]).toContain('not a form');
  });

  it('refuses a form onto any existing tab, a Form tab included', () => {
    for (const tab of [sprintDashboard(), formTab()]) {
      const out = refused(applyReplace(tab, { form }, options));
      expect(out.details[0]).toContain('a changeset makes a new Form tab');
      expect(out.hint).toContain('change_form');
    }
  });
});

describe('a new tab of elements made a Board tab', () => {
  it('stamps the kind and Plan on a new tab only', () => {
    const out = applied(applyReplace(null, { elements: [] }, { ...options, kind: 'board' }));
    expect(out.tab).toMatchObject({ kind: 'board' });
    const kept = applied(
      applyReplace(sprintDashboard(), { elements: [] }, { ...options, kind: 'board' }),
    );
    expect(kept.tab.kind).not.toBe('board');
  });
});
