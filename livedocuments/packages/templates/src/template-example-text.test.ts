import { describe, expect, it } from 'vitest';
import { createText } from '@livedocuments/document';
import { templateExampleText } from './template-example-text';

// docs/specs/006-document/template-examples.md "What is example content": body copy is sample copy on every template.
const text = (label: string) => ({ ...createText(0, 0), label });

describe('templateExampleText', () => {
  it("names a page's body copy and never its heading", () => {
    const rule = templateExampleText('recipe-card');
    expect(rule(text('Sweet tomatoes, creamy beans and a crunchy lemon crumb.'))).toBe(true);
    const heading = { ...text('How to make it'), textBold: true };
    expect(rule(heading)).toBe(false);
  });
});
