// @vitest-environment jsdom
// Send to Diagram's picker (liveworkspace/docs/specs/004-index/send-to-diagram.md "The picker"): the words, where, a
// kind, a name; Preview drafts and shows the sketch before anything is written; Make Diagram (Add Tab, Update Tab)
// writes the previewed graph and opens it in a tab taken in the click; refusals said in the dialog; nothing made on
// Cancel.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IndexError, type DiagramSend } from '@liveworkspace/index-client';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('../../hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { SendToDiagramDialog, diagramName } from './SendToDiagramDialog';
import { elementDiagramSends, setDiagramSendSource } from './diagram-send-store';

const GRAPH = {
  nodes: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  edges: [{ from: 'a', to: 'b' }],
};
const request = {
  words: 'Offer, laptop, day one',
  tabId: 't1',
  elementId: 'b1',
  label: 'Onboarding',
};
const source = { app: 'liveknowledge' as const, itemId: 'kb' };
const SEND: DiagramSend = {
  id: 'ds_1',
  ref: 't1:b1',
  diagram: { id: 'D', title: 'Onboarding diagram' },
  tabId: 'tab-1',
  link: 'https://ld/document/D#t=tab-1',
  at: 1,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  toast.success.mockReset();
  setDiagramSendSource(null);
});

function setup(
  over: {
    drafter?: ReturnType<typeof vi.fn>;
    send?: ReturnType<typeof vi.fn>;
    strict?: boolean;
    earlier?: DiagramSend | null;
    items?: unknown[];
  } = {},
) {
  const drafter = over.drafter ?? vi.fn().mockResolvedValue(GRAPH);
  const sendToDiagram =
    over.send ??
    vi.fn().mockResolvedValue({ item: { id: 'D' }, link: 'https://ld/document/D', send: SEND });
  const listItems = vi.fn().mockResolvedValue({ items: over.items ?? [] });
  const onClose = vi.fn();
  const tab = { closed: false, close: vi.fn(), opener: {}, location: { href: '' } };
  const open = vi.spyOn(window, 'open').mockReturnValue(tab as never);
  const dialog = (
    <SendToDiagramDialog
      request={request}
      source={source}
      sourceTitle="Handbook"
      drafter={drafter as never}
      earlier={over.earlier ?? null}
      onClose={onClose}
      client={{ sendToDiagram, listItems } as never}
    />
  );
  render(over.strict ? <StrictMode>{dialog}</StrictMode> : dialog);
  return { drafter, sendToDiagram, listItems, onClose, tab, open };
}

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

async function previewThenMake(make = 'Make Diagram') {
  fireEvent.click(button('Preview'));
  await screen.findByRole('img', { name: /sketch/ });
  fireEvent.click(button(make));
}

describe('SendToDiagramDialog', () => {
  it('shows the words, New Diagram and Auto chosen, and the name from the page', () => {
    setup();
    expect(screen.getByText('Offer, laptop, day one')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Auto/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /New Diagram/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.queryByRole('radio', { name: /Update/ })).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Onboarding diagram');
    expect(screen.getAllByRole('radio', { name: /Sequence/ })).toHaveLength(1);
  });

  it('previews the draft before writing anything, then makes the diagram and opens it', async () => {
    const { drafter, sendToDiagram, onClose, tab, open } = setup();
    fireEvent.click(screen.getByRole('radio', { name: /Mind Map/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ideas ' } });
    fireEvent.click(button('Preview'));
    expect(
      await screen.findByRole('img', { name: 'A sketch of 2 boxes and 1 arrows' }),
    ).toBeTruthy();
    expect(drafter).toHaveBeenCalledWith({ tabId: 't1', words: request.words, kind: 'mindmap' });
    expect(sendToDiagram).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(button('Make Diagram'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(tab.opener).toBeNull();
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
    expect(drafter).toHaveBeenCalledTimes(1);
    expect(tab.location.href).toBe('https://ld/document/D');
    expect(toast.success).toHaveBeenCalledWith(
      'Diagram made: Onboarding diagram',
      expect.anything(),
    );
    (toast.success.mock.calls[0]![1] as { action: { onSelect: () => void } }).action.onSelect();
    expect(open).toHaveBeenLastCalledWith('https://ld/document/D', '_blank', 'noopener');
  });

  it('records the send for the chips', async () => {
    setDiagramSendSource('kb', null, { diagramSends: vi.fn().mockResolvedValue({ sends: [] }) });
    const { onClose } = setup();
    await previewThenMake();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(elementDiagramSends('b1')).toEqual([SEND]);
  });

  it('drops the preview when the kind changes, and draws again on asking', async () => {
    const { drafter } = setup();
    fireEvent.click(button('Preview'));
    await screen.findByRole('img', { name: /sketch/ });
    fireEvent.click(button('Draw Again'));
    await waitFor(() => expect(drafter).toHaveBeenCalledTimes(2));
    await screen.findByRole('img', { name: /sketch/ });
    fireEvent.click(screen.getByRole('radio', { name: /Sequence/ }));
    expect(screen.queryByRole('img', { name: /sketch/ })).toBeNull();
    expect(button('Preview')).toBeTruthy();
  });

  it('adds a tab to a diagram the person edits, listing only those', async () => {
    const items = [
      { id: 'E', title: 'Flows', access: 'edit' },
      { id: 'V', title: 'Read only', access: 'view' },
    ];
    const { sendToDiagram, listItems, onClose } = setup({ items });
    fireEvent.click(screen.getByRole('radio', { name: /New Tab/ }));
    expect(await screen.findByRole('option', { name: 'Flows' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Read only' })).toBeNull();
    expect(listItems).toHaveBeenCalledWith(
      expect.objectContaining({ app: 'livediagram', view: 'recent' }),
      expect.anything(),
    );
    expect(screen.getByLabelText('Tab name')).toBeTruthy();
    fireEvent.click(button('Preview'));
    await screen.findByRole('img', { name: /sketch/ });
    expect(button('Add Tab').disabled).toBe(true);
    fireEvent.click(screen.getByRole('option', { name: 'Flows' }));
    fireEvent.click(button('Add Tab'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sendToDiagram).toHaveBeenCalledWith(
      expect.objectContaining({ target: { itemId: 'E' }, name: 'Onboarding diagram' }),
    );
  });

  it('opens on Update for a place sent before, redrawing its tab', async () => {
    const { sendToDiagram, onClose } = setup({ earlier: SEND });
    expect(screen.getByRole('radio', { name: /Update/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByLabelText('Name')).toBeNull();
    await previewThenMake('Update Tab');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sendToDiagram).toHaveBeenCalledWith(
      expect.objectContaining({ target: { itemId: 'D', tabId: 'tab-1' } }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      'Tab updated: Onboarding diagram',
      expect.anything(),
    );
  });

  // Strict Mode (every Next dev server) mounts, unmounts and mounts again: the draft must still go on to the index.
  it('makes the diagram under Strict Mode', async () => {
    const { sendToDiagram, onClose } = setup({ strict: true });
    await previewThenMake();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sendToDiagram).toHaveBeenCalledTimes(1);
  });

  it('still makes the diagram when the browser refuses the pending tab', async () => {
    const { onClose, open } = setup();
    open.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    await previewThenMake();
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

  it("says the draft's refusal in the dialog, and lets the person try again", async () => {
    const drafter = vi
      .fn()
      .mockRejectedValueOnce(new Error('You have drawn 20 diagrams this hour.'));
    const { onClose, open } = setup({ drafter });
    fireEvent.click(button('Preview'));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'You have drawn 20 diagrams this hour.',
    );
    expect(open).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(button('Preview').disabled).toBe(false);
  });

  it("words the index's refusals, closing the pending tab", async () => {
    const cases: [unknown, RegExp][] = [
      [new IndexError(429, 'rate_limited'), /a lot of diagrams/],
      [new IndexError(422, 'invalid_graph'), /couldn't draw/],
      [new IndexError(404, 'diagram_gone'), /no longer there/],
      [new IndexError(403, 'forbidden'), /can't edit that diagram/],
      [new IndexError(404, 'not_found'), /can't send words/],
      [new IndexError(503, 'diagram_unavailable'), /couldn't be reached/],
      ['odd', /Check your connection/],
    ];
    for (const [err, words] of cases) {
      const send = vi.fn().mockRejectedValue(err);
      const { tab } = setup({ send });
      await previewThenMake();
      expect((await screen.findByRole('alert')).textContent).toMatch(words);
      expect(tab.close).toHaveBeenCalled();
      cleanup();
    }
  });

  it('opens the diagram in a new tab when none could be taken, and makes nothing with no name', async () => {
    const { onClose, sendToDiagram, open } = setup();
    open.mockReturnValue(null);
    fireEvent.click(button('Preview'));
    await screen.findByRole('img', { name: /sketch/ });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } });
    expect(button('Make Diagram').disabled).toBe(true);
    fireEvent.submit(button('Make Diagram').closest('form')!);
    expect(sendToDiagram).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'X' } });
    fireEvent.click(button('Make Diagram'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(open).toHaveBeenLastCalledWith('https://ld/document/D', '_blank', 'noopener');
    expect(sendToDiagram).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while busy, and an answer after it closed', async () => {
    let finish: (g: unknown) => void = () => {};
    const drafter = vi.fn(() => new Promise((r) => (finish = r)));
    const { onClose, sendToDiagram } = setup({ drafter });
    fireEvent.click(button('Preview'));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    cleanup();
    finish(GRAPH);
    await Promise.resolve();
    expect(sendToDiagram).not.toHaveBeenCalled();
  });

  it('says nothing for a failure after it closed', async () => {
    let fail: (e: unknown) => void = () => {};
    const drafter = vi.fn(() => new Promise((_, r) => (fail = r)));
    setup({ drafter });
    fireEvent.click(button('Preview'));
    cleanup();
    fail(new Error('late'));
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says nothing for a make that fails after it closed', async () => {
    let fail: (e: unknown) => void = () => {};
    const send = vi.fn(() => new Promise((_, r) => (fail = r)));
    setup({ send });
    fireEvent.click(button('Preview'));
    await screen.findByRole('img', { name: /sketch/ });
    fireEvent.click(button('Make Diagram'));
    cleanup();
    fail(new Error('late'));
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks the drafter once while it is reading', async () => {
    const drafter = vi.fn(() => new Promise(() => {}));
    setup({ drafter });
    fireEvent.click(button('Preview'));
    fireEvent.submit(screen.getByRole('button', { name: 'Reading…' }).closest('form')!);
    expect(drafter).toHaveBeenCalledTimes(1);
  });

  it('updates a tab that never learnt its tab or title, and names the diagram it was given', async () => {
    const send = vi.fn().mockResolvedValue({ item: { id: 'D' }, link: 'https://ld/document/D' });
    const { onClose } = setup({
      send,
      earlier: { ...SEND, tabId: '', diagram: { id: 'D', title: '' } },
    });
    await previewThenMake('Update Tab');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Onboarding diagram', target: { itemId: 'D' } }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      'Tab updated: Onboarding diagram',
      expect.anything(),
    );
  });

  it('counts the boxes, arrows and groups the preview shows, one and many', async () => {
    const one = {
      nodes: [{ id: 'a', label: 'A', group: 'g' }],
      edges: [],
      groups: [{ id: 'g', label: 'G' }],
    };
    setup({ drafter: vi.fn().mockResolvedValue(one) });
    fireEvent.click(button('Preview'));
    expect((await screen.findByText(/1 box, 0 arrows, 1 group\./)).textContent).toBeTruthy();
    cleanup();
    const many = {
      nodes: [
        { id: 'a', label: 'A', group: 'g' },
        { id: 'b', label: 'B', group: 'h' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
      groups: [
        { id: 'g', label: 'G' },
        { id: 'h', label: 'H' },
      ],
    };
    setup({ drafter: vi.fn().mockResolvedValue(many) });
    fireEvent.click(button('Preview'));
    expect(await screen.findByText(/2 boxes, 2 arrows, 2 groups\./)).toBeTruthy();
  });

  it('names a diagram after the place, else the source', () => {
    expect(diagramName('Onboarding', 'Handbook')).toBe('Onboarding diagram');
    expect(diagramName('', 'Handbook')).toBe('Handbook diagram');
    expect(diagramName('', '')).toBe('Untitled diagram');
  });
});
