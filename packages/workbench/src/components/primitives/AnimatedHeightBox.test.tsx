// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackBar } from '@liveworkspace/ui';
import { AnimatedHeightBox } from './AnimatedHeightBox';

// docs/specs/004-interface-design/back-bar.md "Always in view": the Tab Style dialog's easing box clips without
// making a scroll box of its own, so the back bar inside it still sticks to the dialog's scroller.
afterEach(cleanup);

describe('AnimatedHeightBox around a BackBar', () => {
  it('is not trapped by an AnimatedHeightBox: uncapped, it clips without making a scroll box', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(
      <AnimatedHeightBox viewKey="colours">
        <BackBar label="Tab Style" current="Colours" onClick={() => {}} />
      </AnimatedHeightBox>,
    );
    const box = screen.getByRole('button', { name: /Tab Style/ }).closest('.overflow-clip');
    expect(box).not.toBeNull();
    expect(box!.className).not.toMatch(/overflow-hidden/);
    vi.unstubAllGlobals();
  });
});
