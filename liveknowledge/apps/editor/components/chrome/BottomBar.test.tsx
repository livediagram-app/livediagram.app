// @vitest-environment jsdom

// The editor's bottom bar (docs/specs/007-editor/editor-app.md "Named on a wide desktop";
// docs/specs/013-workspace/blueprints/workbench-embeds.md WB34, WB15): Tools and Settings, named unless Button
// Labels is off; no pages, which are the page tree's; in a workbench, its Open link and no Appearance control.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DockNamesProvider } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import { BottomBar } from './BottomBar';

afterEach(cleanup);

const toolsText = () => screen.getByRole('button', { name: 'Tools' }).textContent;
const appearance = () => screen.queryAllByRole('button', { name: /appearance|theme|dark|light/i });

describe('BottomBar', () => {
  it('names the footer buttons by default', () => {
    render(<BottomBar onOpenSearch={() => {}} />);
    expect(toolsText()).toBe('Tools');
    expect(screen.getByRole('region', { name: 'Bottom bar' })).toBeTruthy();
  });

  it('shows the footer buttons as icons alone with Button Labels off', () => {
    render(
      <DockNamesProvider value={false}>
        <BottomBar onOpenSearch={() => {}} />
      </DockNamesProvider>,
    );
    expect(toolsText()).toBe('');
  });

  it('keeps History out of the bar, as a row in Tools', () => {
    render(<BottomBar onOpenSearch={() => {}} onOpenHistory={() => {}} />);
    expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
  });

  it('lists no page and offers no way to add one: the pages are the page tree', () => {
    render(<BottomBar onOpenSearch={() => {}} />);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('button', { name: /add|new/i })).toBeNull();
  });

  it('ends with the workbench link, labelled, and offers no Appearance control there', () => {
    render(
      <BottomBar
        onOpenSearch={() => {}}
        workbenchLink={(labelled) => <a href="/document/d">{labelled ? 'Open' : ''}</a>}
      />,
    );
    const link = screen.getByRole('link');
    expect(link.textContent).toBe('Open');
    const tools = screen.getByRole('button', { name: 'Tools' });
    expect(tools.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(appearance()).toHaveLength(0);
  });

  it('keeps the Appearance control in the app', () => {
    render(<BottomBar />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(appearance().length).toBeGreaterThan(0);
  });
});
