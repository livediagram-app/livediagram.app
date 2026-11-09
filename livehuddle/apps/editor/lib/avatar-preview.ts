// The avatar palette's preview (docs/specs/008-canvas/avatar-mode.md "The avatar palette", "The preview, beside the
// flyout"): which option the pointer or the focus is on, and what the preview card draws for it. A module store, so
// pointing along a flyout's tiles re-renders the preview card alone, never the flyout. No React in the pure parts.

import { useSyncExternalStore } from 'react';
import type { AvatarConfig } from '@livehuddle/avatar/config';
import type { AvatarReactionKind } from '@livehuddle/avatar/reactions';
import type { Reaction } from '@liveworkspace/model-core/reaction-bursts';
import type { AvatarStatus } from '@livehuddle/avatar/status';

/** One option being tried on. `label` is its Title Case name, as its tile reads. */
export type AvatarPreview =
  | { kind: 'look'; patch: Partial<AvatarConfig>; label: string }
  | { kind: 'status'; status: AvatarStatus | null; label: string }
  | { kind: 'behaviour'; id: AvatarReactionKind; label: string }
  | { kind: 'reaction'; id: Reaction; label: string };

/** What the card draws: the character, its status, the move or burst playing, and the caption under it. */
export type AvatarPreviewView = {
  config: AvatarConfig;
  status: AvatarStatus | null;
  behaviour: AvatarReactionKind | null;
  burst: Reaction | null;
  title: string;
  line: string;
};

const LINES: Record<AvatarPreview['kind'], string> = {
  look: 'Click to wear it.',
  status: 'Click to set it.',
  behaviour: 'Click to play it. Everyone sees it.',
  reaction: 'Click to throw it.',
};

/** The card for an option tried on over your current look and status; your own character at rest. */
export function previewView(
  preview: AvatarPreview | null,
  config: AvatarConfig,
  status: AvatarStatus | null,
): AvatarPreviewView {
  const rest: AvatarPreviewView = {
    config,
    status,
    behaviour: null,
    burst: null,
    title: 'Your Character',
    line: 'Point at an option to try it on.',
  };
  if (!preview) return rest;
  const shown = { ...rest, title: preview.label, line: LINES[preview.kind] };
  switch (preview.kind) {
    case 'look':
      return { ...shown, config: { ...config, ...preview.patch } };
    case 'status':
      return { ...shown, status: preview.status };
    case 'behaviour':
      return { ...shown, behaviour: preview.id };
    case 'reaction':
      return { ...shown, burst: preview.id };
  }
}

/** Two previews of the same option. */
export function samePreview(a: AvatarPreview | null, b: AvatarPreview | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind || a.label !== b.label) return false;
  return true;
}

let current: AvatarPreview | null = null;
const listeners = new Set<() => void>();

/** Show an option, or nothing (`null`, your own look). Unchanged, it notifies nobody. */
export function setAvatarPreview(next: AvatarPreview | null): void {
  if (samePreview(current, next)) return;
  current = next;
  for (const l of listeners) l();
}

/** Stop showing `option`, if it is still the one shown (a leave arriving after the next option's enter keeps it). */
export function clearAvatarPreview(option: AvatarPreview): void {
  if (samePreview(current, option)) setAvatarPreview(null);
}

export function getAvatarPreview(): AvatarPreview | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAvatarPreview(): AvatarPreview | null {
  return useSyncExternalStore(subscribe, getAvatarPreview, () => null);
}

/**
 * A tile's handlers that try its option on: pointing (a mouse or pen, not a finger, whose tap is a pick) or focusing
 * shows it, leaving or blurring shows your own look again.
 */
export function previewHandlers(option: AvatarPreview) {
  return {
    onPointerEnter: (e: { pointerType: string }) => {
      if (e.pointerType !== 'touch') setAvatarPreview(option);
    },
    onPointerLeave: () => clearAvatarPreview(option),
    onFocus: () => setAvatarPreview(option),
    onBlur: () => clearAvatarPreview(option),
  };
}
