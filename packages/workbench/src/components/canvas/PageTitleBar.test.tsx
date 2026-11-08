// @vitest-environment jsdom
// A page's title bar (PageTitleBar.tsx): its groups, and nothing that makes Safari repaint the board under a drag.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageTitleBar } from './PageTitleBar';

afterEach(() => cleanup());

describe('PageTitleBar', () => {
  it('shows its groups with a divider between them, leaving empty ones out', () => {
    render(
      <PageTitleBar
        groups={[[<button key="a">A</button>, null], [], [<button key="b">B</button>]]}
      />,
    );
    const bar = screen.getByRole('toolbar', { name: 'Page' });
    expect(bar.querySelectorAll('button')).toHaveLength(2);
    expect(bar.querySelectorAll('[data-page-title-bar-divider]')).toHaveLength(1);
  });

  it('renders nothing with nothing to show', () => {
    render(<PageTitleBar groups={[[null, false], []]} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  // In canvas space, under the element layer: a backdrop filter there made Safari repaint every element above it on
  // each frame of a drag (livedesign/docs/specs/008-canvas/canvas-performance.md).
  it('blurs nothing behind it', () => {
    render(<PageTitleBar groups={[[<button key="a">A</button>]]} />);
    expect(screen.getByRole('toolbar', { name: 'Page' }).className).not.toMatch(/backdrop-/);
  });
});
