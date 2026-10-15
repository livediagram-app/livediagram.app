// A form link's address, /form/<code> (docs/specs/030-forms/forms.md "Publishing and the form link"). One static
// page backs every code: the live worker rewrites /form/<anything> onto /form/placeholder, and the page reads the code
// from the address.
import { FORM_CODE_PATTERN } from '@livediagram/forms';

export const FORM_PLACEHOLDER_PATH = '/form/placeholder';

export function isFormPath(pathname: string): boolean {
  return pathname === '/form' || pathname.startsWith('/form/');
}

// The code in the address, or null when there is none that could be one.
export function formCodeFromPath(pathname: string): string | null {
  const match = /^\/form\/([^/?#]+)\/?$/.exec(pathname);
  const code = match?.[1];
  return code && FORM_CODE_PATTERN.test(code) ? code : null;
}

// The link to share: the page's own origin and the code.
export const formUrlFor = (origin: string, code: string) => `${origin}/form/${code}`;
