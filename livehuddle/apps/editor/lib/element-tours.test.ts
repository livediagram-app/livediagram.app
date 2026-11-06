// Element tours' kinds, gate and answers (docs/specs/007-editor/element-tours.md "Remembering answers", "Share roles").

import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import {
  canTourElement,
  elementTourKindOf,
  elementTourSeen,
  markElementTourSeen,
  offerElementTourAgain,
} from './element-tours';

const portal = createShape('portal', 0, 0) as Element;

describe('element tours', () => {
  it('tours a portal, and not a plain shape', () => {
    expect(elementTourKindOf(portal)).toBe('portal');
    expect(elementTourKindOf(createShape('square', 0, 0) as Element)).toBeNull();
    expect(elementTourKindOf(null)).toBeNull();
  });

  it('offers it only to whoever may edit the element', () => {
    expect(canTourElement({ level: 'edit' }, portal, 'portal')).toBe(true);
    expect(canTourElement({ level: 'participate' }, portal, 'portal')).toBe(false);
    expect(canTourElement({ level: 'view' }, portal, 'portal')).toBe(false);
    expect(canTourElement({ level: 'edit' }, { ...portal, locked: true }, 'portal')).toBe(
      false,
    );
  });

  it('remembers an answer, and counts every kind seen under the blanket flag', () => {
    expect(elementTourSeen({}, 'portal')).toBe(false);
    expect(elementTourSeen(markElementTourSeen({}, 'portal'), 'portal')).toBe(true);
    // The flag the retired Power user mode's preset wrote keeps every kind answered
    // (docs/specs/007-editor/power-user-mode.md "What happens to stored preferences").
    expect(elementTourSeen({ elementToursSeen: true }, 'portal')).toBe(true);
  });

  it('marks an answer once', () => {
    const once = markElementTourSeen({}, 'portal');
    expect(markElementTourSeen(once, 'portal')).toEqual({ elementTourKinds: ['portal'] });
  });

  it('offers a kind again, even under the blanket flag', () => {
    const all = { elementToursSeen: true, elementTourKinds: ['portal' as const] };
    const again = offerElementTourAgain(all, 'portal');
    expect(elementTourSeen(again, 'portal')).toBe(false);
    expect(again.elementToursSeen).toBe(false);
  });
});
