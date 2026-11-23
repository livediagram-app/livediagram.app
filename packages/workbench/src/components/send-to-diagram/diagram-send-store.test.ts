// @vitest-environment jsdom
// The open item's diagram sends (diagram-send-store.ts) and a sent block's chip (diagram-chip-dom.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramSend } from '@liveworkspace/index-client';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../bindings', () => ({ workbench: { track } }));
vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import {
  addDiagramSend,
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

describe('the diagram chip', () => {
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
