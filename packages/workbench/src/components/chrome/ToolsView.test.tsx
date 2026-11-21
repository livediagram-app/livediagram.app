// @vitest-environment jsdom
// A tool inside Tools (ToolsView.tsx): exactly the list's height, but never under the room below the band, so a short
// list never leaves a tool's own scroller (History's timeline) squeezed to nothing.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolsView } from './ToolsView';

afterEach(cleanup);

const view = () => document.querySelector<HTMLElement>('[data-tools-view]')!;

describe('ToolsView', () => {
  it('takes the list’s height, keeping its floor under the band', () => {
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
    // No inline min-height: the class's floor (the room under the band) holds over a shorter list.
    expect(view().style.minHeight).toBe('');
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
