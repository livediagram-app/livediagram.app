// The form templates (docs/specs/030-forms/forms.md "Starting a form"): one a form starter, so a form is made from
// the template step, the landing page's gallery and a /new?template= link as it is from Start Planning. Built from
// FORM_STARTERS, never listed twice. The template makes an empty Plan tab; the editor then starts the form on it
// (its board or sheet, its card type), which only the editor can do, so the agents' catalogue leaves them out.
import { FORM_STARTERS, STARTER_IDS, type StarterId } from '@livedesign/forms';
import type { TemplateDescriptor } from './templates';

export type FormTemplateKind = `${StarterId}-form`;

export const FORM_TEMPLATE_KINDS: readonly FormTemplateKind[] = STARTER_IDS.map(
  (id) => `${id}-form` as const,
);

export function isFormTemplateKind(kind: string): kind is FormTemplateKind {
  return (FORM_TEMPLATE_KINDS as readonly string[]).includes(kind);
}

/** The starter a form template starts. */
export function formTemplateStarter(kind: FormTemplateKind): StarterId {
  return kind.slice(0, -'-form'.length) as StarterId;
}

// "Bug Report Form", "Event RSVP Form"; Blank Form keeps its name.
const titleOf = (name: string) => (name.endsWith(' Form') ? name : `${name} Form`);

export const FORM_TEMPLATES: TemplateDescriptor[] = FORM_STARTERS.map((s) => ({
  kind: `${s.id}-form` as const,
  title: titleOf(s.name),
  description:
    s.id === 'blank'
      ? 'An empty form to share by link: add your questions, then choose a board or a sheet for the answers.'
      : `A form to share by link: ${s.line.charAt(0).toLowerCase()}${s.line.slice(1)}.`,
  extra: true,
  editorOnly: true,
}));
