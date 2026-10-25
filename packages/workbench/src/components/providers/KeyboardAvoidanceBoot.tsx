'use client';

import { useFloatingKeyboardAvoidance } from '../../hooks/ui/useFloatingKeyboardAvoidance';

// Keeps every floating surface (popover, menu, floating panel, bottom sheet) in view above a touch screen's
// on-screen keyboard, on every page (hooks/ui/useFloatingKeyboardAvoidance.ts). Renders nothing, and listens for
// nothing under a mouse.
export function KeyboardAvoidanceBoot() {
  useFloatingKeyboardAvoidance();
  return null;
}
