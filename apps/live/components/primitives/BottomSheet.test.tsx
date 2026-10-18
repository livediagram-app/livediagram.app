// @vitest-environment jsdom
// A phone's bottom sheet stands on the coach dock while a tour shows in it (docs/specs/007-editor/coach-dock.md
// "Where it sits"), and on the screen's edge otherwise: it reads the dock floor from one CSS variable.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BottomSheet } from './BottomSheet';

afterEach(cleanup);

const sheet = () => document.querySelector<HTMLElement>('[data-bottom-sheet]')!;

describe('BottomSheet', () => {
  it('stands on the coach dock floor, which is 0 with no tour in the dock', () => {
    render(
      <BottomSheet onClose={() => {}} zClassName="z-10">
        Menu
      </BottomSheet>,
    );
    expect(sheet().style.bottom).toBe('var(--coach-dock-floor, 0px)');
    // The dock clears the home indicator: the sheet's own inset gives up what the floor already holds.
    expect(sheet().style.paddingBottom).toContain('var(--coach-dock-floor, 0px)');
    expect(sheet().style.maxHeight).toContain('var(--coach-dock-floor, 0px)');
  });
});
