import { describe, expect, it } from 'vitest';
import { FORM_STARTERS } from '@liveplanner/forms';
import { buildTemplate, templateTabs } from './build-template';
import {
  FORM_TEMPLATES,
  FORM_TEMPLATE_KINDS,
  formTemplateStarter,
  isFormTemplateKind,
} from './form-templates';
import { templateCategory } from './template-categories';
import { isBlankTemplate, isPlanTemplate } from './template-modes';
import { TEMPLATES, isTemplateKind } from './templates';

// The form templates (docs/specs/030-forms/forms.md "Starting a form"): one a starter, made in the editor.

describe('form templates', () => {
  it('are one a form starter, named after it, in Plan', () => {
    expect(FORM_TEMPLATE_KINDS).toEqual(FORM_STARTERS.map((s) => `${s.id}-form`));
    for (const kind of FORM_TEMPLATE_KINDS) {
      expect(isTemplateKind(kind)).toBe(true);
      expect(isFormTemplateKind(kind)).toBe(true);
      expect(isPlanTemplate(kind)).toBe(true);
      expect(FORM_STARTERS.some((s) => s.id === formTemplateStarter(kind))).toBe(true);
    }
    expect(FORM_TEMPLATES.map((t) => t.title)).toEqual([
      'Blank Form',
      'Bug Report Form',
      'Feedback Form',
      'Feature Request Form',
      'Event RSVP Form',
      'Job Application Form',
      'Contact Form',
    ]);
    expect(TEMPLATES.filter((t) => t.editorOnly).map((t) => t.kind)).toEqual([
      ...FORM_TEMPLATE_KINDS,
    ]);
  });

  it('files Blank Form with the blanks and the rest under Forms', () => {
    expect(isBlankTemplate('blank-form')).toBe(true);
    expect(templateCategory('blank-form')).toBeNull();
    for (const kind of FORM_TEMPLATE_KINDS.filter((k) => k !== 'blank-form'))
      expect(templateCategory(kind)).toBe('forms');
  });

  it('makes one empty tab, for the editor to start the form on', () => {
    expect(buildTemplate('feedback-form', 0, 0)).toEqual([]);
    expect(templateTabs('rsvp-form')).toHaveLength(1);
    expect(isFormTemplateKind('kanban')).toBe(false);
  });
});
