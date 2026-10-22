'use client';

// A photo page's keys (docs/specs/031-photo/photo-tools.md "Keyboard summary"): the tool groups'
// letters (Shift steps to the group's next tool), X and D for the colours, [ and ] for the brush's
// size (Shift: hardness), Escape (the selection, then the tool, one at a time), the number keys for the active layer's opacity while a non-painting tool is
// in hand, and each command's keys (PHOTO_ACTIONS). They act only while a photo page is in focus and
// nobody is typing; the commands' keys only while a photo tool is in hand, so with the select pointer
// they keep acting on elements. While a press is under way (a stroke, a drag) no command and no other tool
// starts: the gesture ends first (the tool's own Enter and Escape still reach it).
import { useEffect } from 'react';
import { setLayer } from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { PHOTO_ACTIONS, runPhotoAction } from '@/lib/photo-editor/photo-actions';
import {
  GROUP_KEYS,
  optionsKey,
  photoTools,
  TOOL_GROUPS,
  type PhotoToolId,
} from '@/lib/photo-editor/tool-state';
import { photoPress } from '@/lib/photo-editor/photo-pointer';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';
import { keysElsewhere } from './PhotoCanvasOverlays';
import { takeTool } from './PhotoToolsRail';

const GROUP_KEY_SET: ReadonlySet<string> = new Set(Object.values(GROUP_KEYS));
// A modifier pressed alone is a held key (Alt, Shift), never a command.
const MODIFIERS: ReadonlySet<string> = new Set(['Alt', 'Shift', 'Meta', 'Control']);

const PAINTING: ReadonlySet<PhotoToolId> = new Set([
  'brush',
  'pencil',
  'eraser',
  'background-eraser',
  'clone',
  'heal',
  'blur',
  'sharpen',
  'smudge',
  'dodge',
  'burn',
  'sponge',
]);

// The bracket keys by their place on the keyboard: with Shift or Alt the character they type changes
// ({, }, or on a Mac “ and ‘).
const KEY_CODES: Readonly<Record<string, string>> = { '[': 'BracketLeft', ']': 'BracketRight' };

// The keys the Layers list takes while one of its rows has focus.
const LIST_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace', 'ArrowUp', 'ArrowDown']);

/** Whether a key event is the chord written as `keys` ("Mod+Shift+N", "Backspace"). */
export function matchesKeys(
  e: {
    key: string;
    code?: string;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
  },
  keys: string,
): boolean {
  const parts = keys.split('+');
  const key = parts.pop()!;
  const want = {
    mod: parts.includes('Mod'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
  };
  const mod = e.metaKey || e.ctrlKey;
  if (mod !== want.mod || e.shiftKey !== want.shift || e.altKey !== want.alt) return false;
  const code = KEY_CODES[key];
  return e.key.toLowerCase() === key.toLowerCase() || (!!code && e.code === code);
}

export function usePhotoShortcuts(photo: PhotoEditorView | null): void {
  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || keysElsewhere()) return;
      // The Layers list takes its own keys while a row has focus (Delete, Backspace, the arrows); every
      // other key (a tool's letter) still reaches the photo.
      if (
        LIST_KEYS.has(e.key) &&
        (e.target as Element | null)?.closest?.('[role="listbox"][aria-label="Layers"]')
      )
        return;
      const state = photoTools.get();
      const inHand = state.tool !== null;
      const mod = e.metaKey || e.ctrlKey;
      if (
        photoPress.get() &&
        !MODIFIERS.has(e.key) &&
        (mod || e.altKey || GROUP_KEY_SET.has(e.key.toLowerCase()))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // A Mac's delete key is Backspace: alone, it is Delete (Clear, or the layer with no selection).
      const plainBackspace = e.key === 'Backspace' && !mod && !e.shiftKey && !e.altKey;
      const chord = plainBackspace
        ? {
            key: 'Delete',
            code: 'Delete',
            shiftKey: false,
            altKey: false,
            metaKey: false,
            ctrlKey: false,
          }
        : e;
      // The commands, while a photo tool is in hand.
      if (inHand)
        for (const a of PHOTO_ACTIONS)
          if (a.keys && matchesKeys(chord, a.keys)) {
            e.preventDefault();
            e.stopPropagation();
            runPhotoAction(a.id, photo);
            return;
          }
      if (mod || e.altKey) return;
      const k = e.key.toLowerCase();
      // A group's letter takes its last tool; with Shift, its next.
      const group = TOOL_GROUPS.find((g) => GROUP_KEYS[g.id] === k);
      if (group) {
        e.preventDefault();
        e.stopPropagation();
        const last = state.lastInGroup[group.id] ?? group.tools[0]!;
        const next = e.shiftKey
          ? group.tools[(group.tools.indexOf(last) + 1) % group.tools.length]!
          : last;
        takeTool(next);
        return;
      }
      if (!inHand) return;
      if (k === 'x') {
        e.preventDefault();
        photoTools.swapColours();
        return;
      }
      if (k === 'd') {
        e.preventDefault();
        photoTools.resetColours();
        return;
      }
      const tool = state.tool!;
      if (e.key === '[' || e.key === ']' || e.key === '{' || e.key === '}') {
        const key = optionsKey(tool);
        const o = state.options[key] as { size?: number; hardness?: number };
        const up = e.key === ']' || e.key === '}';
        e.preventDefault();
        if (e.shiftKey && o.hardness !== undefined)
          photoTools.setOptions(key, {
            hardness: Math.min(1, Math.max(0, o.hardness + (up ? 0.25 : -0.25))),
          });
        else if (o.size !== undefined) {
          // 10% of the size, at least 1 px (photo-tools.md "Shared gestures and options").
          const step = Math.max(1, Math.round(o.size * 0.1));
          photoTools.setOptions(key, {
            size: Math.min(2500, Math.max(1, o.size + (up ? step : -step))),
          });
        }
        return;
      }
      // 1 to 0: the active layer's opacity, 10% to 100%, while a non-painting tool is in hand.
      if (/^[0-9]$/.test(e.key) && !PAINTING.has(tool)) {
        const s = photo.session;
        const layer = s?.layer(s.active);
        if (!s || !layer) return;
        e.preventDefault();
        const opacity = e.key === '0' ? 1 : Number(e.key) / 10;
        s.commitStack(
          setLayer(s.photo, layer.id, { opacity: opacity === 1 ? undefined : opacity }),
          'Opacity',
        );
        return;
      }
      // A category's flyout or the options card open takes Escape to close itself.
      if (
        e.key === 'Escape' &&
        (toolFlyout.isOpen() || document.querySelector('[data-photo-category]'))
      )
        return;
      if (e.key === 'Escape') {
        // Nothing of the tool's own took it (the tool's keys and the options flyout run first): it steps back one
        // thing at a time, the selection first (Reselect brings it back), then the tool, put down so the canvas has
        // the press again.
        e.preventDefault();
        e.stopPropagation();
        if (photo.session?.selection) runPhotoAction('deselect', photo);
        else photoTools.take(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [photo]);
}
