// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { track } from '@/lib/telemetry';
import { ShareDialog } from '@/components/dialogs/ShareDialog';
import type { ShareDialogProps } from '@/components/dialogs/ShareDialog.types';
import { shareTourSteps } from './share-tour-steps';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// jsdom lays nothing out, so "on screen" is just "in the document" here, and there is nothing to scroll.
vi.mock('./tour-dom', async (actual) => ({
  ...(await actual<typeof import('./tour-dom')>()),
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
}));
afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

const TABS = [
  { id: 't1', name: 'Pricing' },
  { id: 't2', name: 'Roadmap' },
];

function renderDialog(over: Partial<ShareDialogProps> = {}) {
  const props: ShareDialogProps = {
    participant: { id: 'me', name: 'Ada', color: '#0ea5e9', status: 'online' },
    links: [],
    sharePasswordSet: false,
    shareUrlFor: (code) => `https://x.test/document/shared?s=${code}`,
    tabs: TABS,
    lockedName: 'Ada',
    onSaveName: vi.fn(),
    onCreateLink: vi.fn(),
    onRevokeLink: vi.fn(),
    onRescopeLink: vi.fn(),
    onExtendLink: vi.fn(),
    onSetPassword: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  const { rerender } = render(<ShareDialog {...props} />);
  return {
    ...props,
    rerender: (next: Partial<ShareDialogProps>): void =>
      rerender((<ShareDialog {...props} {...next} />) as ReactElement),
  };
}

const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)));

const startShowMe = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
  await settle();
};

// docs/specs/007-editor/live-app.md "Show Me".
describe('Share dialog Show Me', () => {
  it('walks the role, Opens, Valid, Create Pass, the passes and the password, then a closing card', () => {
    expect(shareTourSteps(true).map((s) => s.id)).toEqual([
      'role',
      'scope',
      'valid',
      'create',
      'passes',
      'password',
      'outro',
    ]);
    expect(shareTourSteps(true).at(-1)?.card).toBe('outro');
  });

  it('leaves out Opens on a one-tab document, where there is nothing to choose', () => {
    expect(shareTourSteps(false).map((s) => s.id)).not.toContain('scope');
  });

  it('sits in the title row, starts on the role picker and sends its Started event', async () => {
    renderDialog();
    await startShowMe();
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 1 of 6: Choose What They Can Do/ }),
    ).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'ShareTour');
  });

  it('counts five steps on a one-tab document', async () => {
    renderDialog({ tabs: [TABS[0]!] });
    await startShowMe();
    expect(screen.getByRole('dialog', { name: /^Show Me step 1 of 5:/ })).toBeTruthy();
  });

  it('keeps its steps when a tab is added mid-tour', async () => {
    const { rerender } = renderDialog({ tabs: [TABS[0]!] });
    await startShowMe();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await settle();
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 2 of 5: Set How Long It Lasts/ }),
    ).toBeTruthy();
    rerender({ tabs: TABS });
    await settle();
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 2 of 5: Set How Long It Lasts/ }),
    ).toBeTruthy();
  });

  it('counts the document as it is when pressed', async () => {
    const { rerender } = renderDialog({ tabs: [TABS[0]!] });
    rerender({ tabs: TABS });
    await startShowMe();
    expect(screen.getByRole('dialog', { name: /^Show Me step 1 of 6:/ })).toBeTruthy();
  });

  it('keeps Escape from closing the dialog while it runs', async () => {
    const props = renderDialog();
    await startShowMe();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('reports a skip when left before its end', async () => {
    renderDialog();
    await startShowMe();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'ShareTourSkipped');
  });
});
