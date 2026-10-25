// @vitest-environment jsdom
// docs/specs/026-plan/plan-board.md "The name rides in the menu box": a name moves into the menu box only while its
// header sits in a header band, and moves back when the band goes; it is the same node, so its handlers still run.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announceHeaderBand, InMenuBox, MenuNameSlot, TabNameInBox } from './menu-name-slot';
import { setActiveTabName, usePublishTabRename } from '@liveworkspace/workbench/hooks/editor/active-tab-name-store';

afterEach(cleanup);

function Header({ banded, onDoubleClick }: { banded: boolean; onDoubleClick?: () => void }) {
  return (
    <div {...(banded ? { 'data-header-band': '' } : {})}>
      <div data-testid="header" onDoubleClick={onDoubleClick}>
        <InMenuBox render={(inBox) => <span data-in-box={inBox ? 'yes' : 'no'}>Roadmap</span>} />
      </div>
    </div>
  );
}

const slot = () => document.querySelector('[data-menu-name-slot]') as HTMLElement;

describe('InMenuBox', () => {
  it('stays in its header outside a band', () => {
    render(
      <>
        <MenuNameSlot />
        <Header banded={false} />
      </>,
    );
    expect(screen.getByTestId('header').textContent).toBe('Roadmap');
    expect(slot().textContent).toBe('');
    expect(screen.getByText('Roadmap').dataset.inBox).toBe('no');
  });

  it('rides in the menu box inside a band, and comes back when the band goes', () => {
    const view = render(
      <>
        <MenuNameSlot />
        <Header banded />
      </>,
    );
    expect(slot().textContent).toBe('Roadmap');
    expect(screen.getByTestId('header').textContent).toBe('');
    expect(screen.getByText('Roadmap').dataset.inBox).toBe('yes');
    view.rerender(
      <>
        <MenuNameSlot />
        <Header banded={false} />
      </>,
    );
    act(() => announceHeaderBand());
    expect(slot().textContent).toBe('');
    expect(screen.getByTestId('header').textContent).toBe('Roadmap');
  });

  it('keeps its header’s handlers in the box (a double-click renames)', () => {
    const onDoubleClick = vi.fn();
    render(
      <>
        <MenuNameSlot />
        <Header banded onDoubleClick={onDoubleClick} />
      </>,
    );
    fireEvent.doubleClick(screen.getByText('Roadmap'));
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it('stays in its header with no menu box (a phone)', () => {
    render(<Header banded />);
    expect(screen.getByTestId('header').textContent).toBe('Roadmap');
  });
});

// The open tab's name in the menu box (docs/specs/007-editor/toolbar-layout.md "The tab's name").
describe('the tab’s name in the menu box', () => {
  it('shows the open tab’s name after the slot, following a rename', () => {
    act(() => setActiveTabName('Roadmap'));
    const { container } = render(
      <div>
        <MenuNameSlot />
        <TabNameInBox />
      </div>,
    );
    const name = container.querySelector('[data-tab-name-in-box]')!;
    expect(name.textContent).toBe('Roadmap');
    // Hidden by CSS whenever the slot holds an element's name: it sits right after it.
    expect(name.previousElementSibling?.hasAttribute('data-menu-name-slot')).toBe(true);
    expect(name.className).toContain('[[data-menu-name-slot]:not(:empty)+&]:hidden');
    act(() => setActiveTabName('Q4 Roadmap'));
    expect(name.textContent).toBe('Q4 Roadmap');
  });

  it('shows nothing without a tab', () => {
    act(() => setActiveTabName(''));
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
