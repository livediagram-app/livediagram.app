import { describe, expect, it } from 'vitest';
import { EDIT_KEYS, VIEW_TOOL_KEYS, type ShortcutAction } from './useEditorKeyboardShortcuts';
import { runModShortcut } from './editor-shortcut-keys';

// The hook's keydown effect needs jsdom + window event dispatch, which
// this workspace's node-env vitest doesn't run (see docs/specs/003-system-architecture/testing.md).
// What we CAN test in node is the pure key -> action mapping: the lookup
// tables that the effect dispatches through. These assertions pin the
// Edit | Walk toggle's keys (E and V edit, W walks), the add keys, and the keys that left livehuddle with their
// tools (H, K, P, the shape letters and the eraser's E and 0) so an accidental swap or a dropped key is caught.

// A spy `live` that records which deps method fired, so each action can
// be invoked and asserted without a real editor.
function spyLive() {
  const calls: string[] = [];
  const live = {
    setCanvasTool: (t: string) => calls.push(`tool:${t}`),
    addShape: (k: string) => calls.push(`shape:${k}`),
    addText: () => calls.push('text'),
    addSticky: () => calls.push('sticky'),
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
  // docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle".
  it('binds Edit to E, V, the legacy S alias, and number 1', () => {
    expect(fired(VIEW_TOOL_KEYS, 'e')).toBe('tool:select');
    expect(fired(VIEW_TOOL_KEYS, 'v')).toBe('tool:select');
    expect(fired(VIEW_TOOL_KEYS, 's')).toBe('tool:select');
    expect(fired(VIEW_TOOL_KEYS, '1')).toBe('tool:select');
  });

  it('binds Walk to W', () => {
    expect(fired(VIEW_TOOL_KEYS, 'w')).toBe('tool:avatar');
    expect(EDIT_KEYS.w).toBeUndefined();
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "Hand, Eraser and Format as modes".
  it('binds nothing to H, P or 0: Hand and the Eraser are not modes', () => {
    for (const key of ['h', 'p', '0']) {
      expect(VIEW_TOOL_KEYS[key], key).toBeUndefined();
      expect(EDIT_KEYS[key], key).toBeUndefined();
    }
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The presenting tools, Isometric and Zen".
  it('binds nothing to K, I or Z: the Laser, Isometric and Zen left livehuddle', () => {
    expect(VIEW_TOOL_KEYS.k).toBeUndefined();
    expect(VIEW_TOOL_KEYS.l).toBeUndefined();
    expect(VIEW_TOOL_KEYS.i).toBeUndefined();
    expect(VIEW_TOOL_KEYS.z).toBeUndefined();
  });
});

describe('EDIT_KEYS (mutating tools / element adds)', () => {
  it('binds nothing to F (livehuddle has no Frame)', () => {
    expect(EDIT_KEYS.f).toBeUndefined();
  });

  it('binds no Eraser: E is Edit and 0 nothing', () => {
    expect(EDIT_KEYS.e).toBeUndefined();
    expect(EDIT_KEYS['0']).toBeUndefined();
  });

  it('binds Text (T / 8) and Note (N)', () => {
    expect(fired(EDIT_KEYS, 't')).toBe('text');
    expect(fired(EDIT_KEYS, '8')).toBe('text');
    expect(fired(EDIT_KEYS, 'n')).toBe('sticky');
  });

  // docs/specs/012-collaboration/workshop-mode.md "The palette": the diagram tools' keys left with the tools.
  it('binds no diagram tool: no pencil, shape pen, flowchart shape or arrow key', () => {
    for (const key of ['p', 'r', 'o', 'd', 'c', 'g', 'a', '2', '3', '4', '5', '6', '7'])
      expect(EDIT_KEYS[key], key).toBeUndefined();
  });

  it('binds no Hexagon to H', () => {
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

function modLive(isReadOnly = false, canvasTool = 'select') {
  const calls: string[] = [];
  const live = {
    isReadOnly,
    canvasTool,
    onZoomIn: () => calls.push('zoom-in'),
    onZoomOut: () => calls.push('zoom-out'),
    onZoomReset: () => calls.push('zoom-reset'),
    onOpenSearch: () => calls.push('search'),
    undo: () => calls.push('undo'),
    redo: () => calls.push('redo'),
    copySelection: () => calls.push('copy'),
    onCut: () => calls.push('cut'),
    onDuplicate: () => calls.push('duplicate'),
    onSelectAll: () => calls.push('select-all'),
    onBringToFront: () => calls.push('front'),
    onSendToBack: () => calls.push('back'),
  };
  return { live, calls };
}

function chord(
  ev: ModEvent,
  isReadOnly = false,
  canvasTool = 'select',
): { hit: string | null; prevented: boolean } {
  const { live, calls } = modLive(isReadOnly, canvasTool);
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

  // docs/specs/013-workspace/share-roles.md: a Participant undoes and redoes its own changes; a Viewer does not, and
  // neither gets the Editor's chords.
  // A Participant is read-only to the keyboard, as a Viewer (docs/specs/013-workspace/share-roles.md "A Participant
  // walks"): no undo, redo or duplicate.
  // docs/specs/008-canvas/avatar-mode.md "No editing chrome while walking": an Editor walking has no undo or redo
  // either, and the key is not dispatched, so the browser's own undo is swallowed by the caller too.
  it('gives an Editor walking no undo or redo, and still zooms and searches', () => {
    expect(chord({ key: 'z' }, false, 'avatar')).toEqual({ hit: null, prevented: false });
    expect(chord({ key: 'z', shiftKey: true }, false, 'avatar').hit).toBeNull();
    expect(chord({ key: 'y' }, false, 'avatar').hit).toBeNull();
    expect(chord({ key: '=' }, false, 'avatar').hit).toBe('zoom-in');
    expect(chord({ key: 'k' }, false, 'avatar').hit).toBe('search');
    expect(chord({ key: 'z' }, false, 'pan').hit).toBe('undo');
  });

  it('gives a read-only session, a Participant included, no undo, redo or duplicate', () => {
    expect(chord({ key: 'z' }, true).hit).toBeNull();
    expect(chord({ key: 'z', shiftKey: true }, true).hit).toBeNull();
    expect(chord({ key: 'd' }, true).hit).toBeNull();
  });

  it('binds the clipboard and selection verbs', () => {
    expect(chord({ key: 'c' }).hit).toBe('copy');
    expect(chord({ key: 'x' }).hit).toBe('cut');
    expect(chord({ key: 'd' }).hit).toBe('duplicate');
    expect(chord({ key: 'a' }).hit).toBe('select-all');
  });

  it('leaves Cmd+G to the browser now that there are no groups (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
    const { hit, prevented } = chord({ key: 'g' });
    expect(hit).toBeNull();
    expect(prevented).toBe(false);
  });

  it('does not handle Cmd+V, which the native paste event owns', () => {
    expect(chord({ key: 'v' }).hit).toBeNull();
  });

  // not-in-livehuddle.md "Element and Tab Locking": Cmd+Shift+L locked the selection; it is the browser's again.
  it('leaves Cmd+L and Cmd+Shift+L to the browser', () => {
    expect(chord({ key: 'l' }).hit).toBeNull();
    expect(chord({ key: 'l', shiftKey: true }).hit).toBeNull();
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
