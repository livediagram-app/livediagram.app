// @vitest-environment jsdom
// Send to Diagram's picker (liveworkspace/docs/specs/004-index/send-to-diagram.md "The picker"): the words, a kind, a
// name, and Make Diagram: the app's draft, then the index's new diagram, opened in a tab taken in the click; refusals
// said in the dialog; nothing made on Cancel.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IndexError } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('../../hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { SendToDiagramDialog, diagramName } from './SendToDiagramDialog';

const GRAPH = { nodes: [{ id: 'a', label: 'A' }], edges: [] };
const request = {
  words: 'Offer, laptop, day one',
  tabId: 't1',
  elementId: 'b1',
  label: 'Onboarding',
};
const source = { app: 'liveknowledge' as const, itemId: 'kb' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  toast.success.mockReset();
});

function setup(over: { drafter?: ReturnType<typeof vi.fn>; send?: ReturnType<typeof vi.fn> } = {}) {
  const drafter = over.drafter ?? vi.fn().mockResolvedValue(GRAPH);
  const sendToDiagram =
    over.send ?? vi.fn().mockResolvedValue({ item: { id: 'D' }, link: 'https://ld/document/D' });
  const onClose = vi.fn();
  const tab = { closed: false, close: vi.fn(), opener: {}, location: { href: '' } };
  const open = vi.spyOn(window, 'open').mockReturnValue(tab as never);
  render(
    <SendToDiagramDialog
      request={request}
      source={source}
      sourceTitle="Handbook"
      drafter={drafter as never}
      onClose={onClose}
      client={{ sendToDiagram } as never}
    />,
  );
  return { drafter, sendToDiagram, onClose, tab, open };
}

describe('SendToDiagramDialog', () => {
  it('shows the words, Auto chosen, and the name from the page', () => {
    setup();
    expect(screen.getByText('Offer, laptop, day one')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Auto/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Onboarding diagram');
  });

  it('drafts with the kind chosen, makes the diagram, opens it in the tab taken in the click', async () => {
    const { drafter, sendToDiagram, onClose, tab, open } = setup();
    fireEvent.click(screen.getByRole('radio', { name: /Mind Map/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ideas ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(tab.opener).toBeNull();
    expect(drafter).toHaveBeenCalledWith({ tabId: 't1', words: request.words, kind: 'mindmap' });
    expect(sendToDiagram).toHaveBeenCalledWith({
      name: 'Ideas',
      graph: GRAPH,
      source: {
        app: 'liveknowledge',
        itemId: 'kb',
        tabId: 't1',
        elementId: 'b1',
        label: 'Onboarding',
      },
    });
    expect(tab.location.href).toBe('https://ld/document/D');
    expect(toast.success).toHaveBeenCalledWith('Diagram made: Ideas', expect.anything());
    (toast.success.mock.calls[0]![1] as { action: { onSelect: () => void } }).action.onSelect();
    expect(open).toHaveBeenLastCalledWith('https://ld/document/D', '_blank', 'noopener');
  });

  it('still makes the diagram when the browser refuses the pending tab', async () => {
    const { onClose, open } = setup();
    open.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('moves between kinds with the arrow keys', () => {
    setup();
    const auto = screen.getByRole('radio', { name: /Auto/ });
    fireEvent.keyDown(auto, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: /Flowchart/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.keyDown(screen.getByRole('radio', { name: /Flowchart/ }), { key: 'ArrowUp' });
    expect(auto.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(auto, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: /Timeline/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.keyDown(auto, { key: 'a' });
  });

  it("says the draft's refusal in the dialog, closes the pending tab, and lets the person try again", async () => {
    const drafter = vi
      .fn()
      .mockRejectedValueOnce(new Error('You have drawn 20 diagrams this hour.'));
    const { tab, onClose } = setup({ drafter });
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'You have drawn 20 diagrams this hour.',
    );
    expect(tab.close).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Make Diagram' }).disabled).toBe(
      false,
    );
  });

  it("words the index's refusals", async () => {
    const cases: [unknown, RegExp][] = [
      [new IndexError(429, 'rate_limited'), /a lot of diagrams/],
      [new IndexError(422, 'invalid_graph'), /couldn't draw/],
      [new IndexError(404, 'not_found'), /can't send words/],
      [new IndexError(503, 'diagram_unavailable'), /couldn't be reached/],
      ['odd', /Check your connection/],
    ];
    for (const [err, words] of cases) {
      const send = vi.fn().mockRejectedValue(err);
      setup({ send });
      fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
      expect((await screen.findByRole('alert')).textContent).toMatch(words);
      cleanup();
    }
  });

  it('opens the diagram in a new tab when none could be taken, and makes nothing on Cancel or with no name', async () => {
    const { onClose, sendToDiagram, open } = setup();
    open.mockReturnValue(null);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Make Diagram' }).disabled).toBe(
      true,
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(open).toHaveBeenLastCalledWith('https://ld/document/D', '_blank', 'noopener');
    expect(sendToDiagram).toHaveBeenCalledTimes(1);
  });

  it('ignores a submit with no name, Escape while busy, and an answer after it closed', async () => {
    let finish: (g: unknown) => void = () => {};
    const drafter = vi.fn(() => new Promise((r) => (finish = r)));
    const { onClose, sendToDiagram, tab } = setup({ drafter });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Make Diagram' }).closest('form')!);
    expect(drafter).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    cleanup();
    finish(GRAPH);
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(sendToDiagram).not.toHaveBeenCalled();
  });

  it('says nothing for a failure after it closed', async () => {
    let fail: (e: unknown) => void = () => {};
    const drafter = vi.fn(() => new Promise((_, r) => (fail = r)));
    const { tab } = setup({ drafter });
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    cleanup();
    fail(new Error('late'));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
  });

  it('names a diagram after the place, else the source', () => {
    expect(diagramName('Onboarding', 'Handbook')).toBe('Onboarding diagram');
    expect(diagramName('', 'Handbook')).toBe('Handbook diagram');
    expect(diagramName('', '')).toBe('Untitled diagram');
  });
});
