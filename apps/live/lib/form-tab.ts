// A Form tab and its form (docs/specs/030-forms/forms.md "The Form tab"): the tab and the form share one name, so a
// rename or a duplicate's name is the form's heading too.
import { readForm, FORM_HEADING_MAX, type FormDefinition } from '@livediagram/forms';
import type { Tab } from '@livediagram/document';

// The tab's form, read safely; null on any other tab.
export function formOfTab(tab: Pick<Tab, 'kind' | 'form'> | undefined): FormDefinition | null {
  if (!tab || tab.kind !== 'form') return null;
  return readForm(tab.form);
}

// `tab` with its form's heading set to `name` (unchanged for any other tab, or when already so).
export function withFormHeading<T extends Pick<Tab, 'kind' | 'form'>>(tab: T, name: string): T {
  const form = formOfTab(tab);
  const heading = name.trim().slice(0, FORM_HEADING_MAX);
  if (!form || !heading || form.heading === heading) return tab;
  return { ...tab, form: { ...form, heading } };
}
