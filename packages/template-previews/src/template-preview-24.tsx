import type { ReactElement } from 'react';
import { formTemplateStarter, isFormTemplateKind, type TemplateKind } from '@livediagram/templates';
import { FORM_STARTER_VIEWBOX, FormStarterArt } from './form-starter-picture';

// Group 24: the form templates (docs/specs/030-forms/forms.md "Starting a form"): each its starter's picture, as Start
// Planning shows it, in the light palette the tiles share.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const LIGHT = {
  surface: '#ffffff',
  border: '#e2e8f0',
  column: '#f1f5f9',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  warning: '#b45309',
  warningBg: '#fef3c7',
  focus: '#0284c7',
};

export function templatePreviewGroup24(kind: TemplateKind): ReactElement | null {
  if (!isFormTemplateKind(kind)) return null;
  return (
    <svg width="80" height="50" viewBox={FORM_STARTER_VIEWBOX} aria-hidden>
      <FormStarterArt starter={formTemplateStarter(kind)} palette={LIGHT} />
    </svg>
  );
}
