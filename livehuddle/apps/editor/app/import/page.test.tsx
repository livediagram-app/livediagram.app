// @vitest-environment jsdom
// The /import page: opens the asked-for source's import once, and returns to the Explorer when its dialog closes.
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let search = 'source=excalidraw&folder=f1';
let canOpen = true;
const replace = vi.fn();
let closeDialog: () => void = () => {};
const opened = vi.fn();

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock('@liveworkspace/workbench/lib/app-location', () => ({
  replaceAppLocation: (href: string) => {
    replace(href);
  },
}));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({
  useAccountBootstrap: () => ({ authLoaded: true, accountUserId: 'user_1' }),
}));
vi.mock('@/hooks/persistence/useGuestId', () => ({ useGuestId: () => null }));
vi.mock('./useImportDialogs', () => ({
  useImportDialogs: () => {
    const [open, setOpen] = useState(false);
    closeDialog = () => setOpen(false);
    return {
      dialogs: open ? <div role="dialog" aria-label="Import" /> : null,
      open: (id: string) => {
        opened(id);
        if (!canOpen) return false;
        setOpen(true);
        return true;
      },
    };
  },
}));

import ImportPage from './page';

beforeEach(() => {
  replace.mockClear();
  opened.mockClear();
  canOpen = true;
});

describe('/import', () => {
  it('opens the source once, then returns to the folder when the dialog closes', async () => {
    search = 'source=excalidraw&folder=f1';
    render(<ImportPage />);
    expect(await screen.findByRole('dialog', { name: 'Import' })).toBeTruthy();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenCalledWith('excalidraw');
    expect(replace).not.toHaveBeenCalled();
    act(() => closeDialog());
    expect(replace).toHaveBeenCalledWith('/explorer/folder?id=f1');
  });

  it('goes back at once when the source cannot open, or is unknown', () => {
    search = 'source=excalidraw';
    canOpen = false;
    render(<ImportPage />);
    expect(replace).toHaveBeenCalledWith('/explorer/all');
    replace.mockClear();
    search = 'source=figma';
    render(<ImportPage />);
    expect(replace).toHaveBeenCalledWith('/explorer');
  });

  // The draw.io and Microsoft Whiteboard imports left livehuddle (Work Tracker #423, part 4): an old link to
  // either goes back to the Explorer without opening anything.
  it('opens nothing for a retired source', () => {
    for (const source of ['drawio', 'microsoft-whiteboard']) {
      replace.mockClear();
      search = `source=${source}&what=libraries`;
      render(<ImportPage />);
      expect(replace).toHaveBeenCalledWith('/explorer');
    }
    expect(opened).not.toHaveBeenCalled();
  });
});
