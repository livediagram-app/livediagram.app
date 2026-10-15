// A form's look on the page (docs/specs/030-forms/forms.md "Look"): the attributes and CSS variables its root carries.
// forms.css turns them into the accent for the viewer's appearance, the tab font, and boxes drawn in the tab's finish
// (every box marked `form-box`; its neutral outline `form-ink`).
import type { CSSProperties } from 'react';
import { resolveFontStack, type FormLook } from '@livediagram/document';

export type FormLookProps = {
  'data-form-look': '';
  'data-form-finish': FormLook['finish'];
  style: CSSProperties;
};

export function formLookProps(look: FormLook): FormLookProps {
  const font = resolveFontStack(look.font);
  return {
    'data-form-look': '',
    'data-form-finish': look.finish,
    style: {
      '--form-accent-light': look.accent.light,
      '--form-accent-dark': look.accent.dark,
      '--form-on-accent-light': look.onAccent.light,
      '--form-on-accent-dark': look.onAccent.dark,
      ...(font ? { fontFamily: font } : {}),
    } as CSSProperties,
  };
}
