// @vitest-environment jsdom
// The open item's diagram sends (diagram-send-store.ts) and a sent block's chip (diagram-chip-dom.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramSend } from '@liveworkspace/index-client';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../bindings', () => ({ workbench: { track } }));
vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { createElement } from 'react';
import { renderHook } from '@testing-library/react';
import {
  addDiagramSend,
  useElementDiagramSends,
  elementDiagramSends,
  onDiagramSendsChanged,
  refreshDiagramSends,
  setDiagramSendSource,
} from './diagram-send-store';
import { diagramChipDom, diagramChipWords } from './diagram-chip-dom';

const send = (id: string, el: string, title = 'Flows', tabId = 't'): DiagramSend => ({
  id,
  ref: `p:${el}`,
  diagram: { id: `d-${title}`, title },
  tabId,
  link: `https://ld/document/d-${title}#t=${tabId}`,
  at: 1,
});

afterEach(() => {
  setDiagramSendSource(null);
  vi.restoreAllMocks();
  track.mockReset();
});

describe('the diagram send store', () => {
  it('reads the source once named, by element, and tells listeners', async () => {
    const diagramSends = vi.fn().mockResolvedValue({ sends: [send('1', 'b1'), send('2', 'b2')] });
    const heard = vi.fn();
    const stop = onDiagramSendsChanged(heard);
    setDiagramSendSource('kb', { code: 'c' }, { diagramSends });
    await vi.waitFor(() => expect(elementDiagramSends('b1')).toHaveLength(1));
    expect(diagramSends).toHaveBeenCalledWith(
      'kb',
      expect.objectContaining({ share: { code: 'c' } }),
    );
    expect(elementDiagramSends('b2')[0]!.id).toBe('2');
    expect(elementDiagramSends('none')).toEqual([]);
    expect(heard).toHaveBeenCalled();
    setDiagramSendSource('kb', { code: 'c' }, { diagramSends });
    expect(diagramSends).toHaveBeenCalledTimes(1);
    stop();
  });

  it('keeps the chips it had when a read fails, and reads nothing with no source', async () => {
    const diagramSends = vi
      .fn()
      .mockResolvedValueOnce({ sends: [send('1', 'b1')] })
      .mockRejectedValueOnce(new Error('offline'));
    setDiagramSendSource('kb', null, { diagramSends });
    await vi.waitFor(() => expect(elementDiagramSends('b1')).toHaveLength(1));
    await refreshDiagramSends();
    expect(elementDiagramSends('b1')).toHaveLength(1);
    setDiagramSendSource(null);
    await refreshDiagramSends();
    expect(elementDiagramSends('b1')).toEqual([]);
  });

  it('puts a new send first, one entry a place, diagram and tab', async () => {
    setDiagramSendSource('kb', null, { diagramSends: vi.fn().mockResolvedValue({ sends: [] }) });
    await Promise.resolve();
    addDiagramSend(send('1', 'b1'));
    addDiagramSend(send('2', 'b1', 'Other'));
    addDiagramSend(send('3', 'b1'));
    expect(elementDiagramSends('b1').map((s) => s.id)).toEqual(['3', '2']);
  });
});

describe('the diagram send store at its edges', () => {
  it('drops a read that lands after the source changed, and skips a ref naming no element', async () => {
    let land!: (r: { sends: DiagramSend[] }) => void;
    const slow = vi.fn().mockReturnValue(new Promise((r) => (land = r)));
    setDiagramSendSource('a', null, { diagramSends: slow });
    setDiagramSendSource('b', null, {
      diagramSends: vi.fn().mockResolvedValue({ sends: [{ ...send('9', 'x'), ref: 'nocolon' }] }),
    });
    land({ sends: [send('1', 'b1')] });
    await new Promise((r) => setTimeout(r, 0));
    expect(elementDiagramSends('b1')).toEqual([]);
    expect(elementDiagramSends('')).toEqual([]);
  });

  it('gives an element its sends live, and none without an element', async () => {
    setDiagramSendSource('kb', null, { diagramSends: vi.fn().mockResolvedValue({ sends: [] }) });
    await Promise.resolve();
    const initial: { id: string | null } = { id: 'b1' };
    const { result, rerender } = renderHook((props) => useElementDiagramSends(props.id), {
      initialProps: initial,
    });
    expect(result.current).toEqual([]);
    addDiagramSend(send('1', 'b1'));
    rerender({ id: 'b1' });
    expect(result.current.map((s) => s.id)).toEqual(['1']);
    rerender({ id: null });
    expect(result.current).toEqual([]);
  });

  it('shows no sends on a server', async () => {
    const { renderToString } = await import('react-dom/server');
    const Probe = () => String(useElementDiagramSends('b1').length);
    expect(renderToString(createElement(Probe))).toBe('0');
  });
});

describe('the diagram chip', () => {
  it('says how many more diagrams, plural from two', () => {
    expect(diagramChipWords([send('1', 'b'), send('2', 'b', 'B'), send('3', 'b', 'C')]).title).toBe(
      'Flows, and 2 more diagrams. Opens in livediagram.',
    );
    expect(diagramChipWords([send('1', 'b')]).title).toBe('Flows. Opens in livediagram.');
  });

  it('names the newest diagram, +N for the rest, and opens it on its tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const chip = diagramChipDom([send('1', 'b1', 'Flows'), send('2', 'b1', 'Old')]);
    expect(chip.textContent).toBe('Flows+1');
    expect(chip.title).toBe('Flows, and 1 more diagram. Opens in livediagram.');
    expect(chip.getAttribute('aria-label')).toBe('Open the diagram “Flows” in livediagram');
    expect(chip.querySelector('svg')).toBeTruthy();
    const down = new MouseEvent('mousedown', { cancelable: true });
    chip.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    chip.click();
    expect(open).toHaveBeenCalledWith(
      'https://ld/document/d-Flows#t=t',
      '_blank',
      'noopener,noreferrer',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'SentDiagram');
  });

  it('names an untitled diagram', () => {
    expect(diagramChipWords([send('1', 'b1', '')]).label).toBe('Untitled diagram');
  });
});
