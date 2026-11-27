// @vitest-environment jsdom
// A tool inside Tools (ToolsView.tsx): exactly the list's height, but never under the room below the band, so a short
// list never leaves a tool's own scroller (History's timeline) squeezed to nothing.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TOOLS_BACK_LABEL,
  TOOLS_HEIGHT_PX,
  TOOLS_LINE,
  TOOLS_TITLE,
  ToolsHeader,
  ToolsView,
} from './ToolsView';

afterEach(cleanup);

const view = () => document.querySelector<HTMLElement>('[data-tools-view]')!;

describe('ToolsView', () => {
  it('takes the list’s height, never under Tools’ one height', () => {
    render(
      <ToolsView
        id="item-history"
        label="History"
        tall={false}
        sheet={false}
        waiting={false}
        floorPx={260}
      />,
    );
    expect(view().style.height).toBe('260px');
    // Tools' one height in every app (785 px, less the band and the pad), unless the screen is shorter.
    expect(TOOLS_HEIGHT_PX).toBe(785);
    expect(view().style.minHeight).toBe('calc(-104px + min(785px, 100dvh - 2rem))');
    expect(view().className).toContain('min-h-[calc(min(500px,100dvh-2rem)-104px)]');
  });

  it('grows with a phone’s drawer, at least the list’s height', () => {
    render(
      <ToolsView
        id="item-history"
        label="History"
        tall={false}
        sheet
        waiting={false}
        floorPx={260}
      />,
    );
    expect(view().style.minHeight).toBe('260px');
    expect(view().style.height).toBe('');
  });
});

describe('ToolsHeader', () => {
  it('names Tools on the list, its mark in place and no way back', () => {
    render(<ToolsHeader titleId="t" tool={null} onBack={() => {}} sheet={false} />);
    expect(screen.getByRole('heading', { name: TOOLS_TITLE })).toBeTruthy();
    expect(screen.getByText(TOOLS_LINE)).toBeTruthy();
    expect(document.querySelector('[data-dialog-hero-mark="tools"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: TOOLS_BACK_LABEL })).toBeNull();
  });

  it('names the tool and its line on a tool, the mark a back button to Tools', () => {
    const onBack = vi.fn();
    render(
      <ToolsHeader
        titleId="t"
        tool={{ label: 'History', description: 'Who changed what, and when.' }}
        onBack={onBack}
        sheet
      />,
    );
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getByText('Who changed what, and when.')).toBeTruthy();
    // The art stays Tools' pegboard for every tool, as Tab Style keeps its own.
    expect(document.querySelector('[data-dialog-hero-art="tools"]')).not.toBeNull();
    expect(document.querySelector('[data-dialog-hero-mark]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Tools' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
