// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  editorModeKey,
  openedMode,
  pinOpening,
  releaseOpening,
  readRememberedMode,
  rememberMode,
  resolveEditorMode,
  subscribeEditorModes,
} from './editor-mode-store';
import { storageEvent } from '@/lib/testing/storage-event';

const general = { id: 't1', kind: 'diagram' as const };
const drawTab = { id: 't2', kind: 'diagram' as const, opensIn: 'draw' as const };
const esBoard = { id: 't3', kind: 'event-storming' as const };

// Editor modes (docs/specs/007-editor/editor-modes.md "Where the mode lives").
describe('resolveEditorMode', () => {
  // Settings › Experimental (docs/specs/007-editor/editor-modes.md "Experimental modes").
  it('opens a mode that is not offered in Diagram', () => {
    const illustrateTab = { id: 't4', kind: 'diagram' as const, opensIn: 'illustrate' as const };
    const offered = ['diagram', 'draw'] as const;
    expect(
      resolveEditorMode({
        tab: illustrateTab,
        remembered: null,
        opened: null,
        canEdit: true,
        offered,
      }).mode,
    ).toBe('diagram');
    expect(
      resolveEditorMode({
        tab: general,
        remembered: 'illustrate',
        opened: null,
        canEdit: true,
        offered,
      }).mode,
    ).toBe('diagram');
    expect(
      resolveEditorMode({ tab: illustrateTab, remembered: null, opened: null, canEdit: true }).mode,
    ).toBe('illustrate');
  });

  it('opens a tab in its opening mode when nothing is remembered', () => {
    expect(
      resolveEditorMode({ tab: general, remembered: null, opened: null, canEdit: true }),
    ).toEqual({
      mode: 'diagram',
      canSwitch: true,
    });
    expect(
      resolveEditorMode({ tab: drawTab, remembered: null, opened: null, canEdit: true }).mode,
    ).toBe('draw');
  });

  it("lets the person's remembered choice win over the opening mode", () => {
    expect(
      resolveEditorMode({ tab: drawTab, remembered: 'diagram', opened: null, canEdit: true }).mode,
    ).toBe('diagram');
    expect(
      resolveEditorMode({ tab: general, remembered: 'draw', opened: null, canEdit: true }).mode,
    ).toBe('draw');
  });

  it('shows a view-role visitor the opening mode, with no switch', () => {
    expect(
      resolveEditorMode({ tab: drawTab, remembered: 'diagram', opened: null, canEdit: false }),
    ).toEqual({
      mode: 'draw',
      canSwitch: false,
    });
  });

  it('keeps an event-storming board in Diagram mode with no switch', () => {
    expect(
      resolveEditorMode({ tab: esBoard, remembered: 'draw', opened: null, canEdit: true }),
    ).toEqual({
      mode: 'diagram',
      canSwitch: false,
    });
  });

  it('reads Diagram with no switch while there is no tab', () => {
    expect(
      resolveEditorMode({ tab: undefined, remembered: null, opened: null, canEdit: true }),
    ).toEqual({
      mode: 'diagram',
      canSwitch: false,
    });
  });
});

describe('remembered modes', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a choice per tab, device-locally, under livediagram:v2:', () => {
    expect(editorModeKey('t1')).toBe('livediagram:v2:editor-mode:t1');
    rememberMode('t1', 'draw');
    expect(localStorage.getItem('livediagram:v2:editor-mode:t1')).toBe('draw');
    expect(readRememberedMode('t1')).toBe('draw');
    expect(readRememberedMode('t2')).toBeNull();
  });

  it('reads anything unreadable as nothing remembered, and says so', () => {
    localStorage.setItem(editorModeKey('t9'), 'whiteboard');
    expect(readRememberedMode('t9')).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      '[editor-mode] remembered mode unreadable, ignored',
      expect.objectContaining({ tabId: 't9' }),
    );
  });

  it('tells subscribers when a choice changes, until they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEditorModes(listener);
    rememberMode('t1', 'draw');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    rememberMode('t1', 'diagram');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('picks up a choice made in another window of this browser', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEditorModes(listener);
    expect(readRememberedMode('t5')).toBeNull();
    localStorage.setItem(editorModeKey('t5'), 'draw');
    window.dispatchEvent(storageEvent({ key: editorModeKey('t5'), newValue: 'draw' }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readRememberedMode('t5')).toBe('draw');
    unsubscribe();
  });
});

// docs/specs/007-editor/editor-modes.md "Opens in": choosing a tab's opening mode switches nobody's
// current mode. A tab keeps the mode it opened in for this page, until the person switches.
describe('the mode a tab opened in', () => {
  it('outranks a later opening mode, and yields to a switch', () => {
    const opened = { tab: { ...drawTab, opensIn: 'diagram' as const }, opened: 'draw' as const };
    expect(resolveEditorMode({ ...opened, remembered: null, canEdit: true }).mode).toBe('draw');
    expect(resolveEditorMode({ ...opened, remembered: null, canEdit: false }).mode).toBe('draw');
    expect(resolveEditorMode({ ...opened, remembered: 'diagram', canEdit: true }).mode).toBe(
      'diagram',
    );
  });

  it('never puts an event-storming board in Draw', () => {
    const mode = resolveEditorMode({
      tab: esBoard,
      remembered: null,
      opened: 'draw',
      canEdit: true,
    });
    expect(mode.mode).toBe('diagram');
  });

  it('is pinned once per tab, until released', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEditorModes(listener);
    expect(openedMode('p1')).toBeNull();
    pinOpening('p1', 'draw');
    pinOpening('p1', 'diagram');
    expect(openedMode('p1')).toBe('draw');
    expect(listener).toHaveBeenCalledTimes(1);
    releaseOpening('p1');
    expect(openedMode('p1')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
