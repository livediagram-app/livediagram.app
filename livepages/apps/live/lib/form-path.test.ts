import { describe, expect, it } from 'vitest';
import { formCodeFromPath, formUrlFor, isFormPath } from './form-path';

const CODE = 'AbCdEfGhIjKlMnOpQrStU1';

describe('form paths', () => {
  it('reads a code from the address', () => {
    expect(formCodeFromPath(`/form/${CODE}`)).toBe(CODE);
    expect(formCodeFromPath(`/form/${CODE}/`)).toBe(CODE);
    expect(formCodeFromPath('/form/placeholder')).toBeNull();
    expect(formCodeFromPath('/form/')).toBeNull();
    expect(formCodeFromPath(`/form/${CODE}/x`)).toBeNull();
  });

  it('knows its own paths', () => {
    expect(isFormPath('/form')).toBe(true);
    expect(isFormPath(`/form/${CODE}`)).toBe(true);
    expect(isFormPath('/formal')).toBe(false);
    expect(formUrlFor('https://livepages.app', CODE)).toBe(
      `https://livepages.app/form/${CODE}`,
    );
  });
});
