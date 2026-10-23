import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFakeIndex } from '../test/fakeClient';
import { Explorer } from './Explorer';

describe('a host’s own chrome', () => {
  it('adds its rows to the sidebar’s More group and names the every-app filter', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(
      <Explorer
        app="liveplanner"
        client={createFakeIndex().client}
        view={{ kind: 'recent' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/open/${i.id}`}
        onCreate={vi.fn()}
        allLabel="All apps"
        sidebarLinks={[
          { id: 'browser', label: 'This Browser', href: 'https://lp/offline', icon: 'browser' },
        ]}
      />,
    );
    expect(await screen.findByRole('button', { name: 'All apps' })).toBeTruthy();
    const row = screen.getAllByRole('treeitem', { name: 'This Browser' })[0]!;
    row.querySelector<HTMLButtonElement>('button[type=button]:not([aria-hidden])')!.click();
    expect(assign).toHaveBeenCalledWith('https://lp/offline');
    vi.unstubAllGlobals();
  });

  it('says the host’s word on arrival once, as a toast', async () => {
    render(
      <Explorer
        app="liveplanner"
        client={createFakeIndex().client}
        view={{ kind: 'recent' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/open/${i.id}`}
        onCreate={vi.fn()}
        arrivalNotice="The link you opened that plan with was revoked."
      />,
    );
    expect(
      await screen.findAllByText('The link you opened that plan with was revoked.'),
    ).toHaveLength(1);
  });
});
