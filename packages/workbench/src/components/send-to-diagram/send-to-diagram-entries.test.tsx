// @vitest-environment jsdom
// Send to Diagram's entries and host (liveworkspace/docs/specs/004-index/send-to-diagram.md): offered only while the
// editor's host is up, may send and was given a drafter; the text toolbar's button, the words picked in an article's
// writing (the selection menu's and the page toolbar's), and the host opening the picker on the shown page's name.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/index-client', () => ({
  indexClient: { planSends: vi.fn().mockResolvedValue({ sends: [] }) },
}));
vi.mock('../../hooks/ui/useToast', () => ({ useToast: () => ({ success: vi.fn() }) }));

import { setSendSource } from '../send-to-plan/send-store';
import { setSendHere } from '../send-to-plan/send-to-plan-entry';
import { SendToPlanHost } from '../send-to-plan/SendToPlanHost';
import { brandMarkDom, sendArticleWordsToDiagram } from '../send-to-plan/article-send-dom';
import {
  canSendDiagramHere,
  currentDrafter,
  onSendToDiagram,
  sendWordsToDiagram,
  setDiagramDrafter,
  type DiagramSendRequest,
} from './send-to-diagram-entry';
import { SendWordsToDiagramButton } from './SendWordsToDiagramButton';
import { SendToDiagramIcon } from './SendToDiagramIcon';

const drafter = vi.fn().mockResolvedValue({ nodes: [{ id: 'a', label: 'A' }], edges: [] });
const up = () => {
  setSendSource('K', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'liveknowledge', tabId: 't1' });
  setDiagramDrafter(drafter);
};

beforeAll(async () => {
  await import('./SendToDiagramDialog');
});

afterEach(() => {
  cleanup();
  setDiagramDrafter(null);
  setSendHere(null);
  setSendSource(null);
  window.getSelection()?.removeAllRanges();
});

describe('the entry', () => {
  it('offers nothing until the host is up with a drafter, then relays the words', () => {
    const heard: DiagramSendRequest[] = [];
    const stop = onSendToDiagram((r) => heard.push(r));
    expect(canSendDiagramHere()).toBe(false);
    sendWordsToDiagram({ elementId: 'b1', text: 'Words' });
    expect(heard).toEqual([]);
    up();
    expect(canSendDiagramHere()).toBe(true);
    expect(currentDrafter()).toBe(drafter);
    sendWordsToDiagram({ elementId: 'b1', text: '   ' });
    sendWordsToDiagram({ elementId: 'b1', text: ' Words ', label: ' Page ' });
    sendWordsToDiagram({ elementId: null, text: 'More', onTab: 't9' });
    expect(heard).toEqual([
      { words: 'Words', tabId: 't1', elementId: 'b1', label: 'Page' },
      { words: 'More', tabId: 't9', elementId: null, label: '' },
    ]);
    stop();
    sendWordsToDiagram({ elementId: 'b1', text: 'After' });
    expect(heard).toHaveLength(2);
  });

  it('sends the words a page picked, nothing for none', () => {
    up();
    const heard: DiagramSendRequest[] = [];
    const stop = onSendToDiagram((r) => heard.push(r));
    sendArticleWordsToDiagram(null);
    sendArticleWordsToDiagram({ blockId: 'b2', text: ' ' });
    sendArticleWordsToDiagram({ blockId: 'b2', text: 'Ship it' }, 'Release');
    sendArticleWordsToDiagram({ blockId: 'b3', text: 'Plain' });
    expect(heard.map((r) => [r.elementId, r.label])).toEqual([
      ['b2', 'Release'],
      ['b3', ''],
    ]);
    stop();
  });
});

describe('the text toolbar button', () => {
  it('shows only when it can send, and sends the whole text with nothing picked', () => {
    const { container, rerender } = render(
      <SendWordsToDiagramButton elementId="e1" wholeText="All the words" className="b" />,
    );
    expect(container.querySelector('[data-send-to-diagram]')).toBeNull();
    up();
    const heard: DiagramSendRequest[] = [];
    const stop = onSendToDiagram((r) => heard.push(r));
    rerender(<SendWordsToDiagramButton elementId="e1" wholeText="All the words" className="b" />);
    const button = screen.getByRole('button', { name: 'Send the words to a diagram' });
    fireEvent.mouseDown(button);
    fireEvent.click(button);
    expect(heard[0]).toMatchObject({ words: 'All the words', elementId: 'e1' });
    stop();
  });

  it('sends the words a touch press started on, though the tap cleared them', () => {
    up();
    const heard: DiagramSendRequest[] = [];
    const stop = onSendToDiagram((r) => heard.push(r));
    render(<SendWordsToDiagramButton elementId="e1" wholeText="All the words" className="b" />);
    const button = screen.getByRole('button', { name: 'Send the words to a diagram' });
    const picked = vi
      .spyOn(window, 'getSelection')
      .mockReturnValue({ toString: () => 'A to B' } as Selection);
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    picked.mockRestore();
    fireEvent.click(button);
    expect(heard[0]).toMatchObject({ words: 'A to B', elementId: 'e1' });
    stop();
  });

  it('draws livediagram’s logo', () => {
    const { container } = render(<SendToDiagramIcon />);
    expect(container.querySelector('svg')?.getAttribute('style')).toContain('16px');
  });
});

describe("an article's words", () => {
  it('sends the words picked with their block, and nothing without words', () => {
    up();
    const heard: DiagramSendRequest[] = [];
    const stop = onSendToDiagram((r) => heard.push(r));
    sendArticleWordsToDiagram(null);
    sendArticleWordsToDiagram({ blockId: 'b1', text: '  ' });
    expect(heard).toEqual([]);
    sendArticleWordsToDiagram({ blockId: 'b1', text: 'Words' }, 'Onboarding');
    expect(heard[0]).toMatchObject({ words: 'Words', elementId: 'b1', label: 'Onboarding' });
    stop();
  });

  it("draws livediagram's logo in the scheme the app shows", () => {
    document.documentElement.classList.add('dark');
    const dark = brandMarkDom('livediagram', 14);
    document.documentElement.classList.remove('dark');
    expect(dark.getAttribute('width')).toBe('14');
    expect(dark.getAttribute('aria-hidden')).toBe('true');
    expect(dark.outerHTML).not.toBe(brandMarkDom('livediagram', 14).outerHTML);
  });
});

describe('the host', () => {
  it('opens the picker on an ask, named after the shown page, and closes it', async () => {
    render(
      <SendToPlanHost
        app="liveknowledge"
        itemId="K"
        tabId="t1"
        title="Handbook"
        enabled
        diagram={drafter}
        tabTitle=" Onboarding "
      />,
    );
    expect(canSendDiagramHere()).toBe(true);
    act(() => sendWordsToDiagram({ elementId: 'b1', text: 'Words' }));
    const name = await screen.findByLabelText<HTMLInputElement>('Name');
    expect(name.value).toBe('Onboarding diagram');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Name')).toBeNull();
    act(() => sendWordsToDiagram({ elementId: 'b1', text: 'Words', label: 'Own' }));
    expect((await screen.findByLabelText<HTMLInputElement>('Name')).value).toBe('Own diagram');
    cleanup();
    expect(canSendDiagramHere()).toBe(false);
  });

  it('opens the picker for words with no element, offering no Update', async () => {
    render(
      <SendToPlanHost
        app="liveknowledge"
        itemId="K"
        tabId="t1"
        title="Handbook"
        enabled
        diagram={drafter}
      />,
    );
    act(() => sendWordsToDiagram({ elementId: null, text: 'Some words' }));
    expect(await screen.findByLabelText('Name')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Update/ })).toBeNull();
  });

  it('offers no Send to Diagram without a drafter', () => {
    render(<SendToPlanHost app="liveknowledge" itemId="K" title="Handbook" enabled />);
    expect(canSendDiagramHere()).toBe(false);
  });
});
