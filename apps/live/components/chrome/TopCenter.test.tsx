// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopCenterStack } from './TopCenter';

const classesOf = (below?: 'toolbar' | 'dock') => {
  const { container } = render(
    <TopCenterStack below={below}>
      <span />
    </TopCenterStack>,
  );
  return (container.firstElementChild as HTMLElement).className.split(' ');
};

// The top-centre stack never sits under a bar across the top of the canvas
// (docs/specs/007-editor/toolbar-layout.md, docs/specs/023-whiteboard/whiteboard.md "Where the dock sits").
describe('TopCenterStack', () => {
  it('starts at the top from sm, below the phone dock on a phone', () => {
    expect(classesOf()).toEqual(expect.arrayContaining(['top-[4.75rem]', 'sm:top-3']));
  });

  it('starts beneath the Toolbar strip', () => {
    const cls = classesOf('toolbar');
    expect(cls).toContain('top-[4.25rem]');
    expect(cls).not.toContain('sm:top-3');
  });

  it('starts beneath a whiteboard dock at the top, on every viewport', () => {
    const cls = classesOf('dock');
    expect(cls).toContain('top-[4.75rem]');
    expect(cls).not.toContain('sm:top-3');
  });
});
