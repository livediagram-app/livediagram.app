// This editor's facts for Avatar mode (@liveworkspace/avatar, docs/specs/008-canvas/avatar-mode.md "Where the
// code lives"), handed over once, at module scope, before any of it renders: the canvas's avatar wiring
// (components/canvas/useCanvasAvatar.tsx) calls bindAvatar, so the root chunk carries none of it.
import { configureAvatar } from '@liveworkspace/avatar/bindings';
import { shade, tint } from '@livehuddle/document';
import { identityVars } from '@livehuddle/ui';
import { track } from './telemetry';

// The costume's key stays `livehuddle:v2:avatar-config`, so nobody's saved character resets.
export const AVATAR_STORAGE_PREFIX = 'livehuddle:v2:';

export function bindAvatar(): void {
  configureAvatar({ track, storagePrefix: AVATAR_STORAGE_PREFIX, shade, tint, identityVars });
}
