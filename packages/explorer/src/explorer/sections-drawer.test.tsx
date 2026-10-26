// The phone's Sections drawer (livediagram/docs/specs/013-workspace/explorer-structure.md): a modal panel that keeps
// the row a keyboard user moved to, closes on Escape and hands focus back to the button that opened it.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex } from '../test/fakeClient';
import { Explorer } from './Explorer';

afterEach(cleanup);

function page() {
  const index = createFakeIndex({});
  const props = {
    app: 'liveplanner' as const,
    client: index.client,
    view: { kind: 'all' } as const,
    onNavigate: vi.fn(),
    itemHref: (item: { id: string }) => `/plan/${item.id}`,
    viewerId: 'user_me',
    heroHidden: true,
  };
  const { rerender } = render(<Explorer {...props} onCreate={() => {}} />);
  // A fresh onCreate each time, as a host that renders again hands down.
  return { rerender: () => rerender(<Explorer {...props} onCreate={() => {}} />) };
}

describe('the Sections drawer', () => {
  it('keeps focus where it was moved when the Explorer renders again, and returns it on Escape', async () => {
    const { rerender } = page();
    const open = (await screen.findAllByRole('button', { name: 'Browse sections' }))[0]!;
    open.focus();
    fireEvent.click(open);
    const drawer = screen.getByRole('dialog', { name: 'Sections' });
    expect(document.activeElement).toBe(drawer);
    const close = within(drawer).getByRole('button', { name: 'Close' });
    close.focus();
    rerender();
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Sections' })).toBeNull();
    expect(document.activeElement).toBe(open);
  });
});
