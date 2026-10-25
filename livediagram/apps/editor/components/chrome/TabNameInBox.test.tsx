// @vitest-environment jsdom
// The open tab's name in the menu box (docs/specs/007-editor/toolbar-layout.md "The tab's name"): shown in every mode,
// following a rename, and renamed in place by a click for someone who may change the tabs.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabNameInBox } from './TabNameInBox';
import {
  setActiveTabName,
  usePublishTabName,
  usePublishTabRename,
} from '@/hooks/editor/active-tab-name-store';

afterEach(() => {
  cleanup();
  act(() => setActiveTabName(''));
});

describe('the tab’s name in the menu box', () => {
  function Editor({ name }: { name: string }) {
    usePublishTabName(name);
    return null;
  }

  it('shows the name the editor publishes, following a rename, and clears as the editor goes', () => {
    const editor = render(<Editor name="Roadmap" />);
    const { container } = render(<TabNameInBox />);
    expect(container.querySelector('[data-tab-name-in-box]')?.textContent).toBe('Roadmap');
    editor.rerender(<Editor name="Q4 Roadmap" />);
    expect(container.querySelector('[data-tab-name-in-box]')?.textContent).toBe('Q4 Roadmap');
    editor.unmount();
    expect(container.innerHTML).toBe('');
  });

  it('shows nothing without a tab', () => {
    const { container } = render(<TabNameInBox />);
    expect(container.innerHTML).toBe('');
  });
});

describe('renaming the tab from the menu box', () => {
  function Publish({ can, onRename }: { can: boolean; onRename: (id: string, n: string) => void }) {
    usePublishTabRename('tab1', onRename, can);
    return <TabNameInBox />;
  }

  it('renames on a click: Enter saves, Escape puts it back', () => {
    act(() => setActiveTabName('Flowchart'));
    const onRename = vi.fn();
    render(<Publish can onRename={onRename} />);
    fireEvent.click(screen.getByText('Flowchart'));
    const field = screen.getByLabelText('Tab name') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '  Checkout  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('tab1', 'Checkout');
    fireEvent.click(screen.getByText('Flowchart'));
    fireEvent.change(screen.getByLabelText('Tab name'), { target: { value: 'Nope' } });
    fireEvent.keyDown(screen.getByLabelText('Tab name'), { key: 'Escape' });
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Tab name')).toBeNull();
  });

  it('drops a draft when another tab opens, renaming neither', () => {
    function Host({ id, onRename }: { id: string; onRename: (id: string, n: string) => void }) {
      usePublishTabRename(id, onRename, true);
      return <TabNameInBox />;
    }
    act(() => setActiveTabName('Alpha'));
    const onRename = vi.fn();
    const view = render(<Host id="t1" onRename={onRename} />);
    fireEvent.click(screen.getByText('Alpha'));
    const field = screen.getByLabelText('Tab name');
    fireEvent.change(field, { target: { value: 'Typed on Alpha' } });
    act(() => setActiveTabName('Beta'));
    view.rerender(<Host id="t2" onRename={onRename} />);
    // A blur reaching the old field as it goes saves nothing onto the new tab.
    fireEvent.blur(field);
    expect(screen.queryByLabelText('Tab name')).toBeNull();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('offers no rename to someone who may not change the tabs', () => {
    act(() => setActiveTabName('Flowchart'));
    render(<Publish can={false} onRename={vi.fn()} />);
    fireEvent.click(screen.getByText('Flowchart'));
    expect(screen.queryByLabelText('Tab name')).toBeNull();
  });
});
