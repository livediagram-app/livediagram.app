// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@liveplanner/items';
import { ItemPanel } from './ItemPanel';

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.mobile,
}));

// docs/specs/026-plan/plan-board.md "Maximised": a desktop's header holds Maximise Card just left of the close
// button; pressed, the panel fills the window and the button becomes Minimise Card. A phone has no button and never
// maximises, whatever the preference says.

afterEach(() => {
  cleanup();
  viewport.mobile = false;
});

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const CARD: Item = {
  id: 't',
  type: 'task',
  key: 4,
  rank: 'i',
  fields: { title: 'Ship it' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
};

function panel(maximised: boolean, onMaximise?: (on: boolean) => void) {
  const noop = vi.fn();
  render(
    <ItemPanel
      item={CARD}
      types={ITEM_TYPES}
      statuses={[]}
      people={[]}
      labels={[]}
      canEdit={false}
      onSave={noop}
      onPatch={noop}
      onType={noop}
      onOpenItem={noop}
      onTrash={noop}
      onDuplicate={noop}
      onFlag={noop}
      onArchive={noop}
      onClose={noop}
      trail={[CARD]}
      statusNames={new Map()}
      maximised={maximised}
      onMaximise={onMaximise}
    />,
  );
  return screen.getByRole('dialog');
}

describe('Maximise Card', () => {
  it('sits between the ⋯ menu and Close, and maximises when pressed (a Viewer too)', () => {
    const onMaximise = vi.fn();
    panel(false, onMaximise);
    const button = screen.getByRole('button', { name: 'Maximise Card' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    const order = [
      screen.getByRole('button', { name: 'More for #4' }),
      button,
      screen.getByRole('button', { name: 'Close' }),
    ];
    for (let i = 1; i < order.length; i++)
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    fireEvent.click(button);
    expect(onMaximise).toHaveBeenCalledWith(true);
  });

  it('fills the window while maximised, and Minimise Card puts it back', () => {
    const onMaximise = vi.fn();
    const dialog = panel(true, onMaximise);
    expect(dialog.className).toContain('sm:w-[calc(100vw-2rem)]');
    expect(dialog.className).toContain('sm:h-[calc(100dvh-2rem)]');
    const button = screen.getByRole('button', { name: 'Minimise Card' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(onMaximise).toHaveBeenCalledWith(false);
  });

  it('widens Details and keeps the main column to a reading width while maximised', () => {
    panel(true, vi.fn());
    const details = screen.getByRole('complementary', { name: 'Details' });
    expect(details.className).toContain('w-96');
    const title = screen.getByLabelText('Title');
    expect(title.className).toContain('text-[26px]');
    expect(title.closest('.max-w-\\[52rem\\]')).not.toBeNull();
  });

  it('keeps its usual size and Details otherwise', () => {
    const dialog = panel(false, vi.fn());
    expect(dialog.className).not.toContain('sm:w-[calc(100vw-2rem)]');
    expect(screen.getByRole('complementary', { name: 'Details' }).className).toContain('w-80');
    expect(screen.getByLabelText('Title').className).toContain('text-[22px]');
  });

  it('is not offered without a way to keep the choice', () => {
    panel(false);
    expect(screen.queryByRole('button', { name: 'Maximise Card' })).toBeNull();
  });

  it('has no button on a phone, which opens its sheet even with the preference on', () => {
    viewport.mobile = true;
    const dialog = panel(true, vi.fn());
    expect(screen.queryByRole('button', { name: /Maximise Card|Minimise Card/ })).toBeNull();
    expect(dialog.className).not.toContain('sm:w-[calc(100vw-2rem)]');
  });
});
