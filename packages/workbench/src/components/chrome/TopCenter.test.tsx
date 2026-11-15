// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopCenterBanner, TopCenterStack } from './TopCenter';

const classesOf = (below?: 'toolbar' | 'tray' | 'dock') => {
  const { container } = render(
    <TopCenterStack below={below}>
      <span />
    </TopCenterStack>,
  );
  return (container.firstElementChild as HTMLElement).className.split(' ');
};

// The top-centre stack never sits under a bar across the top of the canvas
// (docs/specs/007-editor/toolbar-layout.md, and livediagram's docs/specs/023-draw-mode/draw-mode.md "Where the dock
// sits").
describe('TopCenterStack', () => {
  it('starts at the top from sm, below the phone dock on a phone', () => {
    expect(classesOf()).toEqual(expect.arrayContaining(['top-[4.75rem]', 'sm:top-3']));
  });

  it('starts beneath the Toolbar strip', () => {
    const cls = classesOf('toolbar');
    expect(cls).toContain('top-[4.25rem]');
    expect(cls).not.toContain('sm:top-3');
  });

  it("starts beneath the strip's tray when a message sits under the strip", () => {
    const cls = classesOf('tray');
    expect(cls).toContain('top-[6.75rem]');
    expect(cls).not.toContain('sm:top-3');
  });

  it('starts beneath a whiteboard dock at the top as beneath the strip, on every viewport', () => {
    const cls = classesOf('dock');
    expect(cls).toContain('top-[4.25rem]');
    expect(cls).not.toContain('sm:top-3');
  });
});

describe('TopCenterBanner', () => {
  const bannerClasses = (shape?: 'pill' | 'card') => {
    const { container } = render(<TopCenterBanner shape={shape}>x</TopCenterBanner>);
    return (container.firstElementChild as HTMLElement).className.split(' ');
  };

  it('is a pill by default, and a card (its lines wrapping inside its corners) when asked', () => {
    expect(bannerClasses()).toContain('rounded-full');
    expect(bannerClasses('card')).toContain('rounded-2xl');
    expect(bannerClasses('card')).not.toContain('rounded-full');
  });

  it('marks the stack, which a covering Plan element starts below', () => {
    const { container } = render(<TopCenterStack>x</TopCenterStack>);
    expect((container.firstElementChild as HTMLElement).hasAttribute('data-top-center-stack')).toBe(
      true,
    );
  });
});
