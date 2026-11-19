// @vitest-environment jsdom
// docs/specs/026-plan/plan-board.md "The name rides in the menu box": a name moves into the menu box only while its
// header sits in a header band, and moves back when the band goes; it is the same node, so its handlers still run.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announceHeaderBand, InMenuBox, MenuNameSlot } from './menu-name-slot';

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
