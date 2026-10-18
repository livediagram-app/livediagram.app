// @vitest-environment jsdom
// The slots the coach dock and its chip draw into (docs/specs/007-editor/coach-dock.md "Where it sits"): published
// as they mount, released as they go, and only by the element that holds them.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { coachSlot, setCoachSlot } from './coach-dock-slots';
import { CoachChipSlot, CoachDockSlot } from './CoachDockSlots';

afterEach(cleanup);

describe('coach slots', () => {
  it('publish their element while mounted', () => {
    const { unmount } = render(
      <>
        <CoachDockSlot />
        <CoachChipSlot />
      </>,
    );
    expect(coachSlot('dock')?.hasAttribute('data-coach-dock-slot')).toBe(true);
    expect(coachSlot('chip')?.hasAttribute('data-coach-chip-slot')).toBe(true);
    unmount();
    expect(coachSlot('dock')).toBeNull();
    expect(coachSlot('chip')).toBeNull();
  });

  it('are released only by the element holding them', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    setCoachSlot('dock', a);
    setCoachSlot('dock', b);
    setCoachSlot('dock', null, a);
    expect(coachSlot('dock')).toBe(b);
    setCoachSlot('dock', null, b);
    expect(coachSlot('dock')).toBeNull();
  });
});
