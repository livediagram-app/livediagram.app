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

const timeline = createShape('timeline-rail', 0, 0) as Element;

describe('element tours', () => {
  it('tours a timeline, and not a plain shape', () => {
    expect(elementTourKindOf(timeline)).toBe('timeline');
    expect(elementTourKindOf(createShape('square', 0, 0) as Element)).toBeNull();
    expect(elementTourKindOf(null)).toBeNull();
  });

  it('offers it only to whoever may edit the element', () => {
    expect(canTourElement({ level: 'edit' }, timeline, 'timeline')).toBe(true);
    expect(canTourElement({ level: 'participate' }, timeline, 'timeline')).toBe(false);
    expect(canTourElement({ level: 'view' }, timeline, 'timeline')).toBe(false);
    expect(canTourElement({ level: 'edit' }, { ...timeline, locked: true }, 'timeline')).toBe(
      false,
    );
  });

  it('remembers an answer, and counts every kind seen under the blanket flag', () => {
    expect(elementTourSeen({}, 'timeline')).toBe(false);
    expect(elementTourSeen(markElementTourSeen({}, 'timeline'), 'timeline')).toBe(true);
    // The flag the retired Power user mode's preset wrote keeps every kind answered
    // (docs/specs/007-editor/power-user-mode.md "What happens to stored preferences").
    expect(elementTourSeen({ elementToursSeen: true }, 'timeline')).toBe(true);
  });

  it('marks an answer once', () => {
    const once = markElementTourSeen({}, 'timeline');
    expect(markElementTourSeen(once, 'timeline')).toEqual({ elementTourKinds: ['timeline'] });
  });

  it('offers a kind again, even under the blanket flag', () => {
    const all = { elementToursSeen: true, elementTourKinds: ['timeline' as const] };
    const again = offerElementTourAgain(all, 'timeline');
    expect(elementTourSeen(again, 'timeline')).toBe(false);
    expect(again.elementToursSeen).toBe(false);
  });
});
