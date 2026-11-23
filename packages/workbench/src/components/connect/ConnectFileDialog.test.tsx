// @vitest-environment jsdom

// Connect File from the tab bar's Connect a File (connected-tabs.md "From the tab bar"): the start screen's list in a
// centred dialog named by its heading; a connect, or a press on a file already connected, closes it first and then
// hands on, and its close leaves nothing behind.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionMade, Item } from '@liveworkspace/index-client';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { ConnectFileDialog, type ConnectFileDialogProps } from './ConnectFilePanel';

afterEach(() => {
  cleanup();
  configureWorkbench(WORKBENCH_DEFAULTS);
});

const PLAN = {
  id: 'p1',
  app: 'liveplanner',
  kind: 'plan',
  title: 'Launch plan',
  ownerId: 'me',
  teamId: null,
  folderId: null,
  createdAt: 1,
  updatedAt: 2,
  trashedAt: null,
  summary: {},
  access: 'edit',
} as unknown as Item;
const MADE: ConnectionMade = {
  connection: { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'liveplanner', itemId: 'p1' },
  name: 'Launch plan',
  level: 'edit',
  reverse: null,
};

const setup = (over: Partial<ConnectFileDialogProps> = {}) => {
  configureWorkbench(testBindings({ track: vi.fn() }));
  const order: string[] = [];
  const props: ConnectFileDialogProps = {
    hostId: 'host',
    hostKind: 'canvas',
    hostManaged: true,
    connected: new Map(),
    grant: () => Promise.resolve('grant'),
    newTabId: () => 'new-tab',
    addTab: vi.fn().mockResolvedValue(undefined),
    onConnected: vi.fn(() => order.push('connected')),
    onGoTo: vi.fn(() => order.push('goTo')),
    onClose: vi.fn(() => order.push('close')),
    client: {
      listItems: vi.fn().mockResolvedValue({ items: [PLAN], nextCursor: null }),
      makeConnection: vi.fn().mockResolvedValue(MADE),
      makeBeside: vi.fn(),
      takeBackConnection: vi.fn(),
    },
    ...over,
  };
  render(<ConnectFileDialog {...props} />);
  return { props, order };
};

describe('ConnectFileDialog', () => {
  it('is a dialog named Connect File, and connecting closes it before the new tab opens', async () => {
    const { props, order } = setup();
    expect(screen.getByRole('dialog', { name: 'Connect File' })).toBeTruthy();
    fireEvent.click(await screen.findByText('Launch plan'));
    await waitFor(() => expect(props.onConnected).toHaveBeenCalledWith('new-tab', MADE));
    expect(props.addTab).toHaveBeenCalledWith(MADE, 'new-tab');
    expect(order).toEqual(['close', 'connected']);
  });

  it('goes to a file already connected, closing first', async () => {
    const { props, order } = setup({ connected: new Map([['p1', 'c1']]) });
    fireEvent.click(await screen.findByText('Launch plan'));
    await waitFor(() => expect(props.onGoTo).toHaveBeenCalledWith('c1'));
    expect(order).toEqual(['close', 'goTo']);
  });

  it('closes from its close button, connecting nothing', async () => {
    const { props } = setup();
    await screen.findByText('Launch plan');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.onConnected).not.toHaveBeenCalled();
  });
});
