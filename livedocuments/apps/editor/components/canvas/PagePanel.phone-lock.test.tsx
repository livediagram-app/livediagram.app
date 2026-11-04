// @vitest-environment jsdom

// A page's lock on a phone (docs/specs/007-editor/pages-mode.md "Locking a page", "Beside the cog"): the bar has no
// padlock there, so the cog sheet's actions row holds Lock page or Unlock page; a desktop's panel holds neither.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livedocuments/document';
import type { PageEdits } from '@/hooks/editor/usePagesMode';
import { PagePanel } from './PagePanel';

const phone = vi.hoisted(() => ({ on: true }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => phone.on,
}));

afterEach(() => {
  cleanup();
  phone.on = true;
});

// Each edit a mock of its own, the same one on every read.
const edits = (): PageEdits => {
  const made = new Map<PropertyKey, unknown>();
  const own: Record<string, unknown> = {
    canDuplicate: () => true,
    canMove: () => false,
    cardSplitState: () => 'fits',
  };
  return new Proxy(own, {
    get: (target, key) => {
      if (typeof key === 'string' && key in target) return target[key];
      if (!made.has(key)) made.set(key, vi.fn());
      return made.get(key);
    },
  }) as unknown as PageEdits;
};

const panel = (page: Page, edit = edits()) =>
  render(
    <PagePanel
      page={layOutPages([page])[0]!}
      count={1}
      getAnchor={() => undefined}
      edit={edit}
      onClose={vi.fn()}
    />,
  );

describe("a page's lock on a phone", () => {
  it("locks an open page from the cog sheet's actions", () => {
    const edit = edits();
    panel({ id: 'p', orientation: 'landscape', kind: 'slide' }, edit);
    fireEvent.click(screen.getByRole('button', { name: 'Lock page' }));
    expect(edit.setLocked).toHaveBeenCalledWith('p', true);
  });

  it('unlocks a locked page there, and says so', () => {
    const edit = edits();
    panel({ id: 'p', orientation: 'landscape', kind: 'slide', locked: true }, edit);
    expect(screen.getByRole('status').textContent).toContain('Unlock it below');
    fireEvent.click(screen.getByRole('button', { name: 'Unlock page' }));
    expect(edit.setLocked).toHaveBeenCalledWith('p', false);
  });

  it("leaves a desktop's panel without one: its bar has the padlock", () => {
    phone.on = false;
    panel({ id: 'p', orientation: 'landscape', kind: 'slide' });
    expect(screen.queryByRole('button', { name: /lock page/i })).toBeNull();
  });
});
