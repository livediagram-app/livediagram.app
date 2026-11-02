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

  it('remembers an answer, and counts every kind seen for a power user only', () => {
    expect(elementTourSeen({}, 'timeline')).toBe(false);
    expect(elementTourSeen(markElementTourSeen({}, 'timeline'), 'timeline')).toBe(true);
    expect(elementTourSeen({ elementToursSeen: true }, 'timeline')).toBe(false);
    expect(elementTourSeen({ elementToursSeen: true, powerUserMode: true }, 'timeline')).toBe(true);
  });

  it('marks an answer once', () => {
    const once = markElementTourSeen({}, 'timeline');
    expect(markElementTourSeen(once, 'timeline')).toEqual({ elementTourKinds: ['timeline'] });
  });

  it('offers a kind again, even to a power user', () => {
    const power = {
      powerUserMode: true,
      elementToursSeen: true,
      elementTourKinds: ['timeline' as const],
    };
    const again = offerElementTourAgain(power, 'timeline');
    expect(elementTourSeen(again, 'timeline')).toBe(false);
    expect(again.elementToursSeen).toBe(false);
  });
});
