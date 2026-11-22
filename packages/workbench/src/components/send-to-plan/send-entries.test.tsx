// @vitest-environment jsdom
// Send to Plan's entries (liveworkspace/docs/specs/004-index/send-to-plan.md "Where it is"): the element menu's row, a
// selection's toolbar button, a thread's header and a text toolbar's, each only while this session may send, and
// livehuddle's Send All in reading order.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PlanSend } from '@liveworkspace/index-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { addSends, setSendSource } from './send-store';
import { onSendToPlan, setSendHere, type SendRequest } from './send-to-plan-entry';
import { canSendElements, elementSendItem, sendAllStickies, sendElements } from './send-menu-item';
import { SendToPlanButton } from './SendToPlanButton';
import { SendWordsButton } from './SendWordsButton';
import { ThreadSendToPlan } from './ThreadSendToPlan';

const sent = (ref: string, kind: PlanSend['kind'] = 'element'): PlanSend => ({
  id: `ps_${ref}`,
  ref,
  kind,
  plan: { id: 'P', title: 'Sprint' },
  card: { id: 'c1', title: 'Fix', column: 'To Do', done: false },
  link: 'https://lp/x',
  at: 1,
});

let heard: SendRequest[] = [];
let stop: () => void = () => {};
const up = () => {
  setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'livediagram', tabId: 't1' });
};

beforeEach(() => {
  heard = [];
  stop = onSendToPlan((r) => heard.push(r));
});
afterEach(() => {
  cleanup();
  stop();
  setSendSource(null);
  setSendHere(null);
});

describe('the element menu row', () => {
  it('is there for an element with words while the session may send, on once sent', () => {
    expect(elementSendItem({ id: 'e1', type: 'sticky', label: 'Fix it' })).toBeNull();
    up();
    expect(elementSendItem({ id: 'e1', type: 'sticky', label: '  ' })).toBeNull();
    expect(elementSendItem({ id: 'e1', type: 'sticky' })).toBeNull();
    const row = elementSendItem({ id: 'e1', type: 'sticky', label: 'Fix it' })!;
    expect(row).toMatchObject({
      key: 'send-to-plan',
      on: false,
      detail: 'A card for it in liveplanner',
    });
    row.run();
    expect(heard[0]).toMatchObject({
      noun: 'sticky',
      places: [expect.objectContaining({ elementId: 'e1', tabId: 't1', text: 'Fix it' })],
    });
    act(() => addSends([sent('element:t1:e1:')]));
    expect(elementSendItem({ id: 'e1', type: 'shape', label: 'Box' }, 'Frame')).toMatchObject({
      on: true,
      detail: 'Sent: To Do · Sprint',
    });
    elementSendItem({ id: 'e1', type: 'shape', label: 'Box' }, 'Frame')!.run();
    expect(heard[1]).toMatchObject({
      noun: 'shape',
      places: [expect.objectContaining({ label: 'Frame' })],
    });
    elementSendItem({ id: 'e2', type: 'text', label: 'T' })!.run();
    expect(heard[2]!.noun).toBe('element');
  });
});

describe("a selection's Send to Plan", () => {
  it('sends the elements with words, named for what they are', () => {
    up();
    const a = { id: 'a', type: 'sticky', label: 'One' };
    const b = { id: 'b', type: 'sticky', label: 'Two' };
    const c = { id: 'c', type: 'shape', label: 'Box' };
    const blank = { id: 'z', type: 'image' };
    expect(canSendElements([blank])).toBe(false);
    expect(canSendElements([a, blank])).toBe(true);
    sendElements([a, b, blank]);
    sendElements([a, c]);
    sendElements([c, blank]);
    expect(heard.map((r) => r.noun)).toEqual(['stickies', 'elements', 'shape']);
    expect(heard[0]!.places).toHaveLength(2);
    render(<SendToPlanButton elements={[a, b]} className="btn" />);
    fireEvent.click(screen.getByRole('button', { name: 'Send selected elements to a plan' }));
    expect(heard).toHaveLength(4);
    cleanup();
    setSendHere(null);
    const { container } = render(<SendToPlanButton elements={[a]} className="btn" />);
    expect(container.innerHTML).toBe('');
  });

  it("sends a tab's stickies top to bottom, then left to right, on that tab", () => {
    expect(sendAllStickies('t2', [{ id: 'a', type: 'sticky', label: 'A', x: 0, y: 0 }])).toBeNull();
    up();
    expect(sendAllStickies('t2', [{ id: 's', type: 'shape', label: 'S', x: 0, y: 0 }])).toBeNull();
    const all = sendAllStickies('t2', [
      { id: 'low', type: 'sticky', label: 'Low', x: 0, y: 50 },
      { id: 'right', type: 'sticky', label: 'Right', x: 90, y: 0 },
      { id: 'left', type: 'sticky', label: 'Left', x: 10, y: 0 },
      { id: 'blank', type: 'sticky', label: '', x: 0, y: 0 },
      { id: 'loose', type: 'sticky', label: 'Loose' },
    ])!;
    all();
    expect(heard[0]!.noun).toBe('stickies');
    expect(heard[0]!.places.map((p) => [p.elementId, p.tabId])).toEqual([
      ['loose', 't2'],
      ['left', 't2'],
      ['right', 't2'],
      ['low', 't2'],
    ]);
    sendAllStickies('t2', [{ id: 'one', type: 'sticky', label: 'One', x: 0, y: 0 }])!();
    expect(heard[1]!.noun).toBe('sticky');
  });
});

describe("a thread's header and a text toolbar", () => {
  it('offers a thread with words, and shows its chip once sent', () => {
    const { container, rerender } = render(<ThreadSendToPlan elementId="e1" words="Ship it" />);
    expect(container.innerHTML).toBe('');
    up();
    rerender(<ThreadSendToPlan elementId="e1" words="  " />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<ThreadSendToPlan elementId="e1" words="Ship it" />);
    fireEvent.click(screen.getByRole('button', { name: 'Send this thread to a plan' }));
    expect(heard[0]).toMatchObject({
      noun: 'thread',
      places: [expect.objectContaining({ kind: 'thread', text: 'Ship it' })],
    });
    act(() => addSends([sent('thread:t1:e1:', 'thread')]));
    expect(screen.getByRole('button', { name: /Open the card “Fix”/ })).toBeTruthy();
  });

  it('sends the words picked, or the whole text when none are', () => {
    const { container } = render(
      <SendWordsButton elementId="e1" wholeText=" Whole text " className="b" />,
    );
    expect(container.innerHTML).toBe('');
    cleanup();
    up();
    render(<SendWordsButton elementId="e1" wholeText=" Whole text " className="b" />);
    const button = screen.getByRole('button', { name: 'Send the words to a plan' });
    fireEvent.mouseDown(button);
    const picked = vi
      .spyOn(window, 'getSelection')
      .mockReturnValue({ toString: () => ' Just these ' } as Selection);
    fireEvent.click(button);
    picked.mockReturnValue(null);
    fireEvent.click(button);
    expect(heard.map((r) => r.places[0]!.text)).toEqual(['Just these', 'Whole text']);
    expect(heard[0]!.places[0]).toMatchObject({ kind: 'text', elementId: 'e1' });
    expect(heard[0]!.places[0]!.part).toMatch(/^[0-9a-f]{8}$/);
  });
});
