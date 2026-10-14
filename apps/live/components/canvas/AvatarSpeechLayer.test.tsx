// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpeechBubble } from '@/lib/avatar-speech';
import { AvatarSpeechLayer, type SpeechComposerProps } from './AvatarSpeechLayer';

afterEach(cleanup);

const bubble = (over: Partial<SpeechBubble> = {}): SpeechBubble => ({
  id: 'b1',
  from: 'peer',
  own: false,
  colour: '',
  text: 'hello <b>there</b>',
  tabId: 't1',
  x: 10,
  y: 20,
  bornAt: performance.now(),
  flightMs: 4000,
  ...over,
});

const layer = (
  bubbles: SpeechBubble[],
  composer: SpeechComposerProps | null = null,
  peers = PEERS,
) =>
  render(
    <AvatarSpeechLayer
      bubbles={bubbles}
      activeTabId="t1"
      zoom={0.5}
      peers={peers}
      composer={composer}
      self={{ name: 'Tom', colour: '#14b8a6' }}
    />,
  );
const PEERS = [{ id: 'peer', name: 'Sam', color: '#8b5cf6' }];

describe('AvatarSpeechLayer (docs/specs/008-canvas/avatar-mode.md "Speech bubbles")', () => {
  it('draws a peer’s words as text, with their name under them in their colour', () => {
    layer([bubble()]);
    expect(screen.getByText('hello <b>there</b>')).toBeTruthy();
    const name = screen.getByText('Sam');
    expect(name.style.color).toBe('rgb(139, 92, 246)');
    // The name follows the words.
    expect(screen.getByText('hello <b>there</b>').compareDocumentPosition(name)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('names your own bubble too, in your colour', () => {
    layer([bubble({ own: true, from: 'self', id: 'mine', text: 'mine' })]);
    expect(screen.getByText('Tom').style.color).toBe('rgb(20, 184, 166)');
  });

  it('reads a peer’s message out, once', () => {
    layer([bubble()]);
    expect(screen.getByText('Sam says: hello <b>there</b>')).toBeTruthy();
  });

  it('draws nothing for another tab, or for someone whose character is not here', () => {
    layer([bubble({ tabId: 't2' }), bubble({ id: 'b2', from: 'stranger', text: 'psst' })]);
    expect(screen.queryByText('hello <b>there</b>')).toBeNull();
    expect(screen.queryByText('psst')).toBeNull();
  });

  it('keeps reading size whatever the zoom', () => {
    const { container } = layer([bubble()]);
    expect(container.innerHTML).toContain('scale(2)');
  });

  it('the composer sends on Enter and cancels on Escape', () => {
    const onSend = vi.fn(() => true);
    const onCancel = vi.fn();
    layer([], { head: { x: 0, y: 0 }, coolingDown: false, onSend, onCancel });
    const box = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(box, { target: { value: 'hi\nthere' } });
    expect((box as HTMLTextAreaElement).value).toBe('hi there');
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hi there');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('holds Send while cooling down, and says so', () => {
    layer([], { head: { x: 0, y: 0 }, coolingDown: true, onSend: () => true, onCancel: () => {} });
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'hi' } });
    expect(
      (screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('One moment…')).toBeTruthy();
  });
});
