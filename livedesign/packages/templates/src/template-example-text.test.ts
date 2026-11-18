import { describe, expect, it } from 'vitest';
import { createText } from '@livedesign/design';
import { templateExampleText } from './template-example-text';

// docs/specs/006-design/template-examples.md "What is example content": body copy is sample copy, except on a logo
// template, whose words are the mark.
const text = (label: string) => ({ ...createText(0, 0), label });

describe('templateExampleText', () => {
  it("names a wireframe's body copy and never its heading", () => {
    const rule = templateExampleText('wireframe-mobile-app');
    expect(rule(text('Sign in to Harbour'))).toBe(true);
    const heading = { ...text('Welcome Back'), textBold: true };
    expect(rule(heading)).toBe(false);
  });

  it("names none of a logo template's words", () => {
    for (const kind of [
      'logo-design',
      'logo-lockups',
      'logo-wordmarks',
      'logo-emblems',
      'logo-marks',
    ] as const) {
      expect(templateExampleText(kind)(text('Light for small spaces'))).toBe(false);
    }
  });
});
