// @vitest-environment jsdom

// Settings > Appearance > Button Labels (docs/specs/007-editor/live-app.md "Named on a wide
// desktop"): the footer bar names Search and Settings beside their icons unless it is off.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DockNamesProvider } from '@/hooks/ui/useDockNames';
import { TabBar } from './TabBar';
import { tabBarProps as props } from './TabBar.test-props';

afterEach(cleanup);

const searchText = () => screen.getByRole('button', { name: 'Search' }).textContent;

describe('TabBar Button Labels', () => {
  it('names the footer buttons by default', () => {
    render(<TabBar {...props({ onOpenSearch: () => {} })} />);
    expect(searchText()).toBe('Search');
  });

  it('shows the footer buttons as icons alone with Button Labels off', () => {
    render(
      <DockNamesProvider value={false}>
        <TabBar {...props({ onOpenSearch: () => {} })} />
      </DockNamesProvider>,
    );
    expect(searchText()).toBe('');
  });
});
