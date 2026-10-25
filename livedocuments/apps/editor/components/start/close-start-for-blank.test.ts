// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { emptyCardDismissed } from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import { closeStartForBlank } from './close-start-for-blank';

// docs/specs/007-editor/start-diagramming.md "When it shows": an explicit blank starts blank.
afterEach(() => localStorage.clear());

describe('closeStartForBlank', () => {
  it('closes the start of a blank', () => {
    expect(closeStartForBlank('t', 'blank-illustration')).toBe(true);
    expect(emptyCardDismissed('t:pages')).toBe(true);
    expect(closeStartForBlank('u', 'blank-slide-deck')).toBe(true);
    expect(emptyCardDismissed('u:pages')).toBe(true);
  });

  it('leaves a template and no template alone', () => {
    expect(closeStartForBlank('t', 'slide-deck')).toBe(false);
    expect(closeStartForBlank('t', null)).toBe(false);
    expect(emptyCardDismissed('t:pages')).toBe(false);
  });
});
