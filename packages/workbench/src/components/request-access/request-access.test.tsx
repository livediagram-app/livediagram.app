// @vitest-environment jsdom

// Request Access, the requester's side (liveworkspace/docs/specs/004-index/request-access.md "On screen"; Work Tracker
// 1137 and 1308): the Not Found card's Request Access opens a note in place and sends it once, then says Requested;
// the live embed's button sends without a note; both agree per item in the tab, never ask twice, and say why a press
// failed. Only the `missing` case on the app's own address offers it.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';

const requestAccess = vi.fn();
vi.mock('../../lib/index-client', () => ({ indexClient: { requestAccess } }));

const { NotFound } = await import('../chrome/NotFound');
const { RequestAccess } = await import('./RequestAccess');
const { RequestAccessButton } = await import('./RequestAccessButton');
const { forgetRequested, markRequested, askIndex } = await import('./requested');

beforeEach(() => {
  requestAccess.mockReset();
  requestAccess.mockResolvedValue({ requested: true });
});
afterEach(() => {
  act(() => forgetRequested());
  cleanup();
});

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Request Access' }));
const note = () => screen.getByRole('textbox', { name: 'Add a note (optional)' });

describe('on the Not Found card', () => {
  it('offers Request Access beside its buttons, with the hint that says so', () => {
    const onOpenExplorer = vi.fn();
    const onCreateNew = vi.fn();
    render(
      <NotFound
        noun="plan"
        onOpenExplorer={onOpenExplorer}
        onCreateNew={onCreateNew}
        requestAccess={{ itemId: 'p1' }}
      />,
    );
    expect(
      screen.getByText(
        'Joining a colleague on this plan? Request access, and whoever runs it is asked to share it with you.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/via the Share button/)).toBeNull();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Open Explorer', 'New Plan', 'Request Access']);
    fireEvent.click(screen.getByRole('button', { name: 'Open Explorer' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Plan' }));
    expect(onOpenExplorer).toHaveBeenCalledOnce();
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('offers it with no other buttons', () => {
    render(<NotFound noun="plan" requestAccess={{ itemId: 'p1' }} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Request Access']);
  });

  it.each([
    ['in an embed', { embed: true }],
    ['on another case', { reason: 'sign-in' as const }],
    ['with no item', { requestAccess: null }],
  ])('leaves it out %s', (_, over) => {
    render(<NotFound noun="plan" requestAccess={{ itemId: 'p1' }} {...over} />);
    expect(screen.queryByRole('button', { name: 'Request Access' })).toBeNull();
  });

  it('opens a note in place, focused, and sends it trimmed once', async () => {
    render(<RequestAccess itemId="p1" noun="plan" />);
    open();
    expect(screen.queryByRole('button', { name: 'Request Access' })).toBeNull();
    expect(document.activeElement).toBe(note());
    expect(note().getAttribute('placeholder')).toBe('Why you need this plan');
    expect(note().getAttribute('maxlength')).toBe('300');
    fireEvent.change(note(), { target: { value: '  On the launch team  ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));
    });
    expect(requestAccess).toHaveBeenCalledWith('p1', { note: 'On the launch team' });
    expect(screen.getByRole('status').textContent).toBe('Requested');
    expect(screen.getByText('If its owner shares it with you, you’ll get an email.')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('sends with no note, and with Ctrl or Cmd and Enter', async () => {
    render(<RequestAccess itemId="p1" noun="plan" />);
    open();
    await act(async () => {
      fireEvent.keyDown(note(), { key: 'Enter', metaKey: true });
    });
    expect(requestAccess).toHaveBeenCalledWith('p1', {});
    cleanup();
    act(() => forgetRequested());
    render(<RequestAccess itemId="p2" noun="plan" />);
    open();
    await act(async () => {
      fireEvent.keyDown(note(), { key: 'Enter', ctrlKey: true });
    });
    expect(requestAccess).toHaveBeenLastCalledWith('p2', {});
  });

  it('lets a plain Enter and other keys type', () => {
    render(<RequestAccess itemId="p1" noun="plan" />);
    open();
    fireEvent.keyDown(note(), { key: 'Enter' });
    fireEvent.keyDown(note(), { key: 'a' });
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('cancels with Escape or Cancel, focus back on Request Access', () => {
    render(<RequestAccess itemId="p1" noun="plan" />);
    open();
    fireEvent.keyDown(note(), { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Request Access' }));
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('counts the note once it nears its limit', () => {
    render(<RequestAccess itemId="p1" noun="plan" />);
    open();
    fireEvent.change(note(), { target: { value: 'a'.repeat(249) } });
    expect(screen.queryByText('249/300')).toBeNull();
    fireEvent.change(note(), { target: { value: 'a'.repeat(250) } });
    expect(screen.getByText('250/300')).toBeTruthy();
  });

  it('says Sending… and takes no second press while one is out', async () => {
    let finish: (v: unknown) => void = () => {};
    requestAccess.mockReturnValue(new Promise((r) => (finish = r)));
    render(<RequestAccess itemId="p1" noun="plan" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));
    const sending = screen.getByRole('button', { name: /Sending/ });
    fireEvent.click(sending);
    fireEvent.keyDown(note(), { key: 'Enter', metaKey: true });
    expect(requestAccess).toHaveBeenCalledTimes(1);
    await act(async () => finish({ requested: true }));
    expect(screen.getByRole('status').textContent).toBe('Requested');
  });

  it.each([
    [new IndexError(429, 'rate_limited'), 'You’ve asked for access a lot today. Try again later.'],
    [new IndexError(401, 'unauthorized'), 'Sign in to ask for access.'],
    [new IndexError(500, 'unknown'), 'Couldn’t send your request. Try again.'],
    [new Error('offline'), 'Couldn’t send your request. Try again.'],
  ])('says why it failed (%s), and lets them try again', async (error, words) => {
    requestAccess.mockRejectedValueOnce(error);
    render(<RequestAccess itemId="p1" noun="plan" />);
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));
    });
    expect(screen.getByRole('alert').textContent).toBe(words);
    expect(note()).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Requested');
  });

  it('shows Requested for an item already asked about in this tab, and never asks again', async () => {
    act(() => markRequested('p1'));
    act(() => markRequested('p1'));
    render(<RequestAccess itemId="p1" noun="plan" />);
    expect(screen.getByRole('status').textContent).toBe('Requested');
    expect(screen.queryByRole('button', { name: 'Request Access' })).toBeNull();
  });

  it('skips a send for an item asked about elsewhere while the note was open', async () => {
    render(<RequestAccess itemId="p1" noun="plan" />);
    open();
    const send = screen.getByRole('button', { name: 'Send Request' });
    act(() => markRequested('p1'));
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.submit(send.closest('form') ?? document.createElement('form'));
    expect(requestAccess).not.toHaveBeenCalled();
  });
});

describe('on a live embed', () => {
  it('sends without a note, off the canvas, then says Requested', async () => {
    const onPointerDown = vi.fn();
    const onDoubleClick = vi.fn();
    const onClick = vi.fn();
    render(
      <div onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} onClick={onClick}>
        <RequestAccessButton itemId="p1" />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Request Access' });
    fireEvent.pointerDown(button);
    fireEvent.doubleClick(button);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onDoubleClick).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(requestAccess).toHaveBeenCalledWith('p1', {});
    expect(screen.getByRole('status').textContent).toBe('Requested');
  });

  it('says Sending… while out, and why it failed', async () => {
    let fail: (e: unknown) => void = () => {};
    requestAccess.mockReturnValue(new Promise((_, r) => (fail = r)));
    render(<RequestAccessButton itemId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Request Access' }));
    expect(screen.getByRole('button', { name: /Sending/ }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    await act(async () => fail(new IndexError(429, 'rate_limited')));
    expect(screen.getByRole('alert').textContent).toBe(
      'You’ve asked for access a lot today. Try again later.',
    );
  });

  it('agrees with the Not Found card and every other embed of the item', async () => {
    render(
      <>
        <RequestAccessButton itemId="p1" />
        <RequestAccessButton itemId="p1" />
        <RequestAccessButton itemId="p9" />
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Request Access' })[0]!);
    });
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Request Access' })).toHaveLength(1);
  });

  it('takes an ask of its own', async () => {
    const ask = vi.fn(async () => {});
    render(<RequestAccessButton itemId="p1" ask={ask} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Request Access' }));
    });
    expect(ask).toHaveBeenCalledWith('p1', null);
    expect(requestAccess).not.toHaveBeenCalled();
  });
});

it('renders Request Access on the server, before the tab can know', async () => {
  const { renderToString } = await import('react-dom/server');
  act(() => markRequested('p1'));
  expect(renderToString(<RequestAccessButton itemId="p1" />)).toContain('Request Access');
});

it('asks the index with the note, or none', async () => {
  await askIndex('p1', 'Hi');
  await askIndex('p2', null);
  expect(requestAccess.mock.calls).toEqual([
    ['p1', { note: 'Hi' }],
    ['p2', {}],
  ]);
});
