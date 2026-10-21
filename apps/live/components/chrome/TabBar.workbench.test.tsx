// @vitest-environment jsdom

// A workbench frame's tab bar (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB34, WB15):
// Open in livediagram at its right end, and no Appearance control, since the workbench sets the scheme.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TabBar } from './TabBar';
import { tabBarProps as props } from './TabBar.test-props';

afterEach(cleanup);

const appearance = () => screen.queryAllByRole('button', { name: /appearance|theme|dark|light/i });

describe('TabBar in a workbench', () => {
  it('ends with the workbench link, labelled, and offers no Appearance control', () => {
    render(
      <TabBar
        {...props({
          onOpenSearch: () => {},
          workbenchLink: (labelled) => <a href="/document/d">{labelled ? 'Open' : ''}</a>,
        })}
      />,
    );

    const link = screen.getByRole('link');
    expect(link.textContent).toBe('Open');
    const search = screen.getByRole('button', { name: 'Search' });
    expect(search.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(appearance()).toHaveLength(0);
  });

  it('keeps the Appearance control in the app', () => {
    render(<TabBar {...props({})} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(appearance().length).toBeGreaterThan(0);
  });
});
