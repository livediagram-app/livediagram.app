// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopCenterBanner, TopCenterRow, TopCenterStack } from './TopCenter';

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

// The phone layout's centring: a pill across the stack sits between equal insets (card 1219, the offline banner at
// ~450 px sat 24 px from the left and 12 px from the right).
describe('centring on a phone', () => {
  it('insets the stack equally on both sides, and centres it from sm', () => {
    const cls = classesOf();
    const insets = cls.filter((c) => /^(left|right)-/.test(c));
    expect(insets.sort()).toEqual(['left-3', 'right-3']);
    expect(cls).toEqual(
      expect.arrayContaining(['sm:left-1/2', 'sm:right-auto', 'sm:-translate-x-1/2']),
    );
  });

  const rowClasses = (across?: boolean) => {
    const { container } = render(<TopCenterRow across={across}>x</TopCenterRow>);
    return (container.firstElementChild as HTMLElement).className.split(' ');
  };

  it('stretches a row across the stack on a phone, centring its banner, only when asked', () => {
    expect(rowClasses(true)).toEqual(
      expect.arrayContaining(['self-stretch', 'sm:self-auto', 'justify-center']),
    );
    // Other pills keep the phone's top-right anchor.
    expect(rowClasses()).not.toContain('self-stretch');
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
