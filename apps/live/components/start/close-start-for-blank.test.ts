// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { emptyCardDismissed } from '@/components/canvas/empty-card-dismissed';
import { closeStartForBlank } from './close-start-for-blank';

// docs/specs/007-editor/start-diagramming.md "When it shows": an explicit blank starts blank.
afterEach(() => localStorage.clear());

describe('closeStartForBlank', () => {
  it('closes the start of a blank in its own mode', () => {
    expect(closeStartForBlank('t', 'blank')).toBe(true);
    expect(emptyCardDismissed('t:diagram')).toBe(true);
    expect(closeStartForBlank('u', 'whiteboard')).toBe(true);
    expect(emptyCardDismissed('u:draw')).toBe(true);
  });

  it('leaves a template, a Plan blank and no template alone', () => {
    expect(closeStartForBlank('t', 'flowchart')).toBe(false);
    expect(closeStartForBlank('t', 'blank-plan')).toBe(false);
    expect(closeStartForBlank('t', null)).toBe(false);
    expect(emptyCardDismissed('t:diagram')).toBe(false);
  });
});
