// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { createServiceStatusStore } from '@/lib/service-status-store';

// docs/specs/009-elements/live-status.md "Who may bind": an Editor's dialog alone; each write one step, tracked.

const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { LiveStatusDialogHost } from './LiveStatusDialogHost';

// The dialog's code loads once up front, so its dynamic import resolves at once in each test.
beforeAll(async () => {
  await import('./LiveStatusDialog');
});

afterEach(() => {
  cleanup();
  track.mockReset();
});

const URL_A = 'https://status.example.com/';

function host(level: 'edit' | 'participate' | 'view', element: Element) {
  // A second element, which neither write touches.
  let elements: Element[] = [element, { id: 'other', type: 'sticky' } as Element];
  const commitElements = vi.fn((map: (els: Element[]) => Element[]) => {
    elements = map(elements);
  });
  const store = createServiceStatusStore(() => 0);
  store.receive({ [URL_A]: { state: 'up', checkedAt: 0 } });
  ctx.current = {
    liveStatusOpenForId: element.id,
    setLiveStatusOpenForId: vi.fn(),
    activeTab: { id: 't', name: 'T', elements },
    can: { level },
    commitElements,
    serviceStatuses: store,
  };
  render(<LiveStatusDialogHost />);
  return { commitElements, after: () => elements[0]! };
}

const shape = (over: Record<string, unknown> = {}) =>
  ({ ...createShape('square', 0, 0), id: 'sq', ...over }) as Element;

describe('LiveStatusDialogHost', () => {
  it('opens for an Editor, saves the binding in one step and counts it', async () => {
    const h = host('edit', shape());
    const field = await screen.findByLabelText<HTMLInputElement>(
      'Status URL',
      {},
      { timeout: 5000 },
    );
    fireEvent.change(field, { target: { value: 'status.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(h.commitElements).toHaveBeenCalledTimes(1);
    expect((h.after() as { statusUrl?: string }).statusUrl).toBe(URL_A);
    expect(track).toHaveBeenCalledWith('Element', 'Linked', 'LiveStatus');
  });

  it('shows the current state and removes the binding in one step', async () => {
    const h = host('edit', shape({ statusUrl: URL_A }));
    expect(
      await screen.findByRole('img', { name: 'Live status: Up' }, { timeout: 5000 }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(h.commitElements).toHaveBeenCalledTimes(1);
    expect('statusUrl' in h.after()).toBe(false);
    expect(track).toHaveBeenCalledWith('Element', 'Cleared', 'LiveStatus');
  });

  it.each(['participate', 'view'] as const)('never opens for a %s session', (level) => {
    host(level, shape());
    expect(screen.queryByLabelText('Status URL')).toBeNull();
  });

  it('never opens on a locked shape, a vanished one or nothing', () => {
    host('edit', shape({ locked: true }));
    expect(screen.queryByLabelText('Status URL')).toBeNull();
    cleanup();
    ctx.current = { ...ctx.current, activeTab: { id: 't', name: 'T', elements: [] } };
    render(<LiveStatusDialogHost />);
    ctx.current = { ...ctx.current, liveStatusOpenForId: null, serviceStatuses: null };
    render(<LiveStatusDialogHost />);
    expect(screen.queryByLabelText('Status URL')).toBeNull();
  });
});
