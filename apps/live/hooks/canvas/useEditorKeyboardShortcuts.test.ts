import { describe, expect, it } from 'vitest';
import { EDIT_KEYS, VIEW_TOOL_KEYS, type ShortcutAction } from './useEditorKeyboardShortcuts';
import { runModShortcut } from './editor-shortcut-keys';

// The hook's keydown effect needs jsdom + window event dispatch, which
// this workspace's node-env vitest doesn't run (see specs/18-testing.md).
// What we CAN test in node is the pure key -> action mapping: the lookup
// tables that the effect dispatches through. These assertions pin the
// standards-aligned remap (V = Select, H = Hand, K = Laser, P = Pencil,
// the shape letters, and the Excalidraw number-row aliases) so an
// accidental swap or a dropped key is caught.

// A spy `live` that records which deps method fired, so each action can
// be invoked and asserted without a real editor.
function spyLive() {
  const calls: string[] = [];
  const live = {
    setCanvasTool: (t: string) => calls.push(`tool:${t}`),
    onToggleZen: () => calls.push('zen'),
    onBeginFreehand: () => calls.push('pencil'),
    onBeginShapePen: () => calls.push('shape-pen'),
    addShape: (k: string) => calls.push(`shape:${k}`),
    addText: () => calls.push('text'),
    addSticky: () => calls.push('sticky'),
    addArrow: () => calls.push('arrow'),
  };
  // The actions only touch the subset of deps above; cast through unknown
  // so we don't have to stub the whole EditorKeyboardShortcutsDeps bag.
  return { live: live as unknown as Parameters<ShortcutAction>[0], calls };
}

function fired(table: Record<string, ShortcutAction>, key: string): string {
  const action = table[key];
  expect(action, `expected a binding for "${key}"`).toBeDefined();
  const { live, calls } = spyLive();
  action!(live);
  expect(calls).toHaveLength(1);
  return calls[0]!;
}

describe('VIEW_TOOL_KEYS (non-mutating tools)', () => {
  it('binds Select to V, the legacy S alias, and number 1', () => {
    expect(fired(VIEW_TOOL_KEYS, 'v')).toBe('tool:select');
    expect(fired(VIEW_TOOL_KEYS, 's')).toBe('tool:select');
    expect(fired(VIEW_TOOL_KEYS, '1')).toBe('tool:select');
  });

  it('binds Hand to H (not P, which is now Pencil)', () => {
    expect(fired(VIEW_TOOL_KEYS, 'h')).toBe('tool:pan');
    expect(VIEW_TOOL_KEYS.p).toBeUndefined();
  });

  it('binds Laser to K (not L)', () => {
    expect(fired(VIEW_TOOL_KEYS, 'k')).toBe('tool:laser');
    expect(VIEW_TOOL_KEYS.l).toBeUndefined();
  });

  it('keeps Isometric on I and Zen on Z', () => {
    expect(fired(VIEW_TOOL_KEYS, 'i')).toBe('tool:isometric');
    expect(fired(VIEW_TOOL_KEYS, 'z')).toBe('zen');
  });
});

describe('EDIT_KEYS (mutating tools / element adds)', () => {
  it('binds Pencil to P and number 7, and Frame to F', () => {
    expect(fired(EDIT_KEYS, 'p')).toBe('pencil');
    expect(fired(EDIT_KEYS, '7')).toBe('pencil');
    expect(fired(EDIT_KEYS, 'f')).toBe('shape:frame');
  });

  it('binds Eraser to E and number 0', () => {
    expect(fired(EDIT_KEYS, 'e')).toBe('tool:eraser');
    expect(fired(EDIT_KEYS, '0')).toBe('tool:eraser');
  });

  it('maps the flowchart shape letters and their Excalidraw number aliases', () => {
    expect(fired(EDIT_KEYS, 'r')).toBe('shape:square');
    expect(fired(EDIT_KEYS, '2')).toBe('shape:square');
    expect(fired(EDIT_KEYS, 'o')).toBe('shape:circle');
    expect(fired(EDIT_KEYS, '4')).toBe('shape:circle');
    expect(fired(EDIT_KEYS, 'd')).toBe('shape:diamond');
    expect(fired(EDIT_KEYS, '3')).toBe('shape:diamond');
    expect(fired(EDIT_KEYS, 'c')).toBe('shape:cylinder');
    expect(fired(EDIT_KEYS, 'g')).toBe('shape:parallelogram');
  });

  it('binds Text (T / 8), Note (N), and Arrow (A / 5)', () => {
    expect(fired(EDIT_KEYS, 't')).toBe('text');
    expect(fired(EDIT_KEYS, '8')).toBe('text');
    expect(fired(EDIT_KEYS, 'n')).toBe('sticky');
    expect(fired(EDIT_KEYS, 'a')).toBe('arrow');
    expect(fired(EDIT_KEYS, '5')).toBe('arrow');
  });

  it('no longer binds Hexagon to H (H is the Hand tool now)', () => {
    // Hexagon is click-only; H must not add a shape from either table.
    expect(EDIT_KEYS.h).toBeUndefined();
  });

  it('does not duplicate any view-tool key in the edit table', () => {
    for (const key of Object.keys(VIEW_TOOL_KEYS)) {
      expect(EDIT_KEYS[key], `key "${key}" should live in only one table`).toBeUndefined();
    }
  });
});

// The Cmd / Ctrl chords, which lived inline in the hook's keydown until
// runModShortcut was lifted out beside the tables above. They are pure of
// the DOM apart from the event itself, so node-env can drive them with a
// plain object standing in for the KeyboardEvent.

type ModEvent = {
  key: string;
  shiftKey?: boolean;
  code?: string;
  prevented?: boolean;
};

function modLive(isReadOnly = false) {
  const calls: string[] = [];
  const live = {
    isReadOnly,
    onZoomIn: () => calls.push('zoom-in'),
    onZoomOut: () => calls.push('zoom-out'),
    onZoomReset: () => calls.push('zoom-reset'),
    onOpenSearch: () => calls.push('search'),
    undo: () => calls.push('undo'),
    redo: () => calls.push('redo'),
    copySelection: () => calls.push('copy'),
    onCut: () => calls.push('cut'),
    onDuplicate: () => calls.push('duplicate'),
    onGroupOrUngroup: () => calls.push('group'),
    onToggleLock: () => calls.push('lock'),
    onSelectAll: () => calls.push('select-all'),
    onBringToFront: () => calls.push('front'),
    onSendToBack: () => calls.push('back'),
  };
  return { live, calls };
}

function chord(ev: ModEvent, isReadOnly = false): { hit: string | null; prevented: boolean } {
  const { live, calls } = modLive(isReadOnly);
  let prevented = false;
  const e = {
    key: ev.key,
    shiftKey: ev.shiftKey ?? false,
    code: ev.code ?? '',
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as KeyboardEvent;
  runModShortcut(e, live as unknown as Parameters<typeof runModShortcut>[1]);
  return { hit: calls[0] ?? null, prevented };
}

describe('runModShortcut (Cmd / Ctrl chords)', () => {
  it('zooms on + / = / - / 0', () => {
    expect(chord({ key: '=' }).hit).toBe('zoom-in');
    expect(chord({ key: '+' }).hit).toBe('zoom-in');
    expect(chord({ key: '-' }).hit).toBe('zoom-out');
    expect(chord({ key: '0' }).hit).toBe('zoom-reset');
  });

  it('opens search on . and K', () => {
    // `.` because browsers reserve Cmd/Ctrl+T; K is the palette convention.
    expect(chord({ key: '.' }).hit).toBe('search');
    expect(chord({ key: 'k' }).hit).toBe('search');
    expect(chord({ key: 'K' }).hit).toBe('search');
  });

  it('separates undo from its three redo spellings', () => {
    expect(chord({ key: 'z' }).hit).toBe('undo');
    expect(chord({ key: 'z', shiftKey: true }).hit).toBe('redo');
    expect(chord({ key: 'y' }).hit).toBe('redo');
  });

  it('binds the clipboard and selection verbs', () => {
    expect(chord({ key: 'c' }).hit).toBe('copy');
    expect(chord({ key: 'x' }).hit).toBe('cut');
    expect(chord({ key: 'd' }).hit).toBe('duplicate');
    expect(chord({ key: 'g' }).hit).toBe('group');
    expect(chord({ key: 'a' }).hit).toBe('select-all');
  });

  it('does not handle Cmd+V, which the native paste event owns', () => {
    expect(chord({ key: 'v' }).hit).toBeNull();
  });

  it('requires Shift for Lock, since plain Cmd+L is the address bar', () => {
    expect(chord({ key: 'l' }).hit).toBeNull();
    expect(chord({ key: 'l', shiftKey: true }).hit).toBe('lock');
  });

  it('matches z-order on `code` so a non-US layout still reaches it', () => {
    // The shifted bracket arrives as `}` / `{` on some layouts, so the
    // code check is what makes the chord reachable there.
    expect(chord({ key: ']', shiftKey: true }).hit).toBe('front');
    expect(chord({ key: '}', shiftKey: true, code: 'BracketRight' }).hit).toBe('front');
    expect(chord({ key: '[', shiftKey: true }).hit).toBe('back');
    expect(chord({ key: '{', shiftKey: true, code: 'BracketLeft' }).hit).toBe('back');
    // Without Shift they are not z-order at all.
    expect(chord({ key: ']' }).hit).toBeNull();
  });

  it('gives a view-role visitor the zoom and search chords and nothing else', () => {
    expect(chord({ key: '=' }, true).hit).toBe('zoom-in');
    expect(chord({ key: 'k' }, true).hit).toBe('search');
    expect(chord({ key: 'z' }, true).hit).toBeNull();
    expect(chord({ key: 'x' }, true).hit).toBeNull();
    expect(chord({ key: 'a' }, true).hit).toBeNull();
  });

  it('preventDefaults what it handles, and leaves the rest alone', () => {
    expect(chord({ key: 'z' }).prevented).toBe(true);
    expect(chord({ key: 'j' }).prevented).toBe(false);
  });
});
