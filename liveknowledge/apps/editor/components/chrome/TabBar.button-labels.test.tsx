// @vitest-environment jsdom

// Settings > Appearance > Button Labels (docs/specs/007-editor/editor-app.md "Named on a wide
// desktop"): the footer bar names Tools and Settings beside their icons unless it is off.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DockNamesProvider } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import { TabBar } from './TabBar';
import { tabBarProps as props } from './TabBar.test-props';

afterEach(cleanup);

const toolsText = () => screen.getByRole('button', { name: 'Tools' }).textContent;

describe('TabBar Button Labels', () => {
  it('names the footer buttons by default', () => {
    render(<TabBar {...props({ onOpenSearch: () => {} })} />);
    expect(toolsText()).toBe('Tools');
  });

  it('shows the footer buttons as icons alone with Button Labels off', () => {
    render(
      <DockNamesProvider value={false}>
        <TabBar {...props({ onOpenSearch: () => {} })} />
      </DockNamesProvider>,
    );
    expect(toolsText()).toBe('');
  });

  it('keeps History out of the bar, as a row in Tools', () => {
    render(<TabBar {...props({ onOpenSearch: () => {}, onOpenHistory: () => {} })} />);
    expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tools' }).textContent).toBe('Tools');
  });
});
