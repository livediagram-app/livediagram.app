// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  editorModeKey,
  readRememberedMode,
  rememberMode,
  resolveEditorMode,
  subscribeEditorModes,
} from './editor-mode-store';

const general = { id: 't1', kind: 'diagram' as const };
const drawTab = { id: 't2', kind: 'diagram' as const, opensIn: 'draw' as const };
const esBoard = { id: 't3', kind: 'event-storming' as const };

// Editor modes (docs/specs/007-editor/editor-modes.md "Where the mode lives").
describe('resolveEditorMode', () => {
  it('opens a tab in its opening mode when nothing is remembered', () => {
    expect(resolveEditorMode({ tab: general, remembered: null, canEdit: true })).toEqual({
      mode: 'diagram',
      canSwitch: true,
    });
    expect(resolveEditorMode({ tab: drawTab, remembered: null, canEdit: true }).mode).toBe('draw');
  });

  it("lets the person's remembered choice win over the opening mode", () => {
    expect(resolveEditorMode({ tab: drawTab, remembered: 'diagram', canEdit: true }).mode).toBe(
      'diagram',
    );
    expect(resolveEditorMode({ tab: general, remembered: 'draw', canEdit: true }).mode).toBe(
      'draw',
    );
  });

  it('shows a view-role visitor the opening mode, with no switch', () => {
    expect(resolveEditorMode({ tab: drawTab, remembered: 'diagram', canEdit: false })).toEqual({
      mode: 'draw',
      canSwitch: false,
    });
  });

  it('keeps an event-storming board in Diagram mode with no switch', () => {
    expect(resolveEditorMode({ tab: esBoard, remembered: 'draw', canEdit: true })).toEqual({
      mode: 'diagram',
      canSwitch: false,
    });
  });

  it('reads Diagram with no switch while there is no tab', () => {
    expect(resolveEditorMode({ tab: undefined, remembered: null, canEdit: true })).toEqual({
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
    window.dispatchEvent(new StorageEvent('storage', { key: editorModeKey('t5') }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readRememberedMode('t5')).toBe('draw');
    unsubscribe();
  });
});
