// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { emptyCardDismissed } from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import { closeStartForBlank } from './close-start-for-blank';

// docs/specs/007-editor/start-diagramming.md "When it shows": an explicit blank starts blank.
afterEach(() => localStorage.clear());

describe('closeStartForBlank', () => {
  it('closes the start of a blank in its own mode', () => {
    expect(closeStartForBlank('t', 'blank-session')).toBe(true);
    expect(emptyCardDismissed('t:workshop')).toBe(true);
    expect(closeStartForBlank('v', 'team-pod')).toBe(false);
  });
});
