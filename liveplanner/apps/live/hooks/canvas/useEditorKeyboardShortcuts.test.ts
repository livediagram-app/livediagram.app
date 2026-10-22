import { describe, expect, it } from 'vitest';
import { VIEW_TOOL_KEYS, type ShortcutAction } from './useEditorKeyboardShortcuts';
import { runModShortcut } from './editor-shortcut-keys';

// The hook's keydown effect needs jsdom + window event dispatch, which
// this workspace's node-env vitest doesn't run (see docs/specs/003-system-architecture/testing.md).
// What we CAN test in node is the pure key -> action mapping: the lookup
// table that the effect dispatches through.

// A spy `live` that records which deps method fired, so each action can
// be invoked and asserted without a real editor.
function spyLive() {
  const calls: string[] = [];
  const live = {
    setCanvasTool: (t: string) => calls.push(`tool:${t}`),
    onToggleZen: () => calls.push('zen'),
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

describe('VIEW_TOOL_KEYS', () => {
  it('binds Z to Zen and nothing else: the canvas tool and element-add keys went with the palette', () => {
    expect(fired(VIEW_TOOL_KEYS, 'z')).toBe('zen');
    expect(Object.keys(VIEW_TOOL_KEYS)).toEqual(['z']);
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

function modLive(isReadOnly = false, participant = false) {
  const calls: string[] = [];
  const live = {
    isReadOnly,
    participant,
    onZoomIn: () => calls.push('zoom-in'),
    onZoomOut: () => calls.push('zoom-out'),
    onZoomReset: () => calls.push('zoom-reset'),
    onOpenSearch: () => calls.push('search'),
    undo: () => calls.push('undo'),
    redo: () => calls.push('redo'),
    copySelection: () => calls.push('copy'),
    onCut: () => calls.push('cut'),
    onDuplicate: () => calls.push('duplicate'),
    onToggleLock: () => calls.push('lock'),
    onSelectAll: () => calls.push('select-all'),
    onBringToFront: () => calls.push('front'),
    onSendToBack: () => calls.push('back'),
  };
  return { live, calls };
}

function chord(
  ev: ModEvent,
  isReadOnly = false,
  participant = false,
): { hit: string | null; prevented: boolean } {
  const { live, calls } = modLive(isReadOnly, participant);
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
  it("gives a Participant undo and redo and nothing else of an Editor's", () => {
    expect(chord({ key: 'z' }, true, true).hit).toBe('undo');
    expect(chord({ key: 'z', shiftKey: true }, true, true).hit).toBe('redo');
    expect(chord({ key: 'd' }, true, true).hit).toBeNull();
    expect(chord({ key: 'z' }, true, false).hit).toBeNull();
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
