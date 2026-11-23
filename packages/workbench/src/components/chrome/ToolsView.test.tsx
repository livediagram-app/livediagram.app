// @vitest-environment jsdom
// A tool inside Tools (ToolsView.tsx): exactly the list's height, but never under the room below the band, so a short
// list never leaves a tool's own scroller (History's timeline) squeezed to nothing.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TOOLS_HEIGHT_PX, ToolsView } from './ToolsView';

afterEach(cleanup);

const view = () => document.querySelector<HTMLElement>('[data-tools-view]')!;

describe('ToolsView', () => {
  it('takes the list’s height, never under Tools’ one height', () => {
    render(
      <ToolsView
        id="item-history"
        label="History"
        onBack={() => {}}
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
        onBack={() => {}}
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
