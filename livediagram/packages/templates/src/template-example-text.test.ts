import { describe, expect, it } from 'vitest';
import { createText } from '@livediagram/document';
import { templateExampleText } from './template-example-text';

// docs/specs/006-document/template-examples.md "What is example content": a template opts its sample copy in by its
// words; every other free text is structure.
const text = (label: string) => ({ ...createText(0, 0), label });

describe('templateExampleText', () => {
  it("names a worked example's sample copy, and nothing else on the board", () => {
    expect(templateExampleText('fishbone')(text('Peak days run understaffed'))).toBe(true);
    expect(templateExampleText('fishbone')(text('The problem'))).toBe(false);
    expect(templateExampleText('timeline')(text('Group ordering picked as the bet'))).toBe(true);
    expect(templateExampleText('roadmap')(text('Day-1 activation 38% → 50%'))).toBe(true);
    expect(templateExampleText('venn')(text('Cheap to build, pays on paper, nobody asked'))).toBe(
      true,
    );
  });

  it('names no free text on a template that opts none in', () => {
    expect(templateExampleText('retrospective')(text('What should we keep doing?'))).toBe(false);
    expect(templateExampleText('flowchart')(text('Follow one order to confirmation.'))).toBe(false);
  });
});
