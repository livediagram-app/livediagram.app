// Speaking in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Speech bubbles", blueprint
// docs/specs/008-canvas/blueprints/avatar-speech.md): the composer's open state, Enter to open it, the cooldown
// between messages, and sending. What is on screen lives in lib/avatar-speech-store; the drawing in
// AvatarSpeechLayer.

import { useEffect, useEffectEvent, useState } from 'react';
import { clampSayText } from '@liveworkspace/api-schema/avatar-say';
import { addOwnBubble } from '../speech-store';
import { headPoint, SPEECH_COOLDOWN_MS } from '../speech';
import type { AvatarPoint } from '../walk';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { anyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';
import { avatarBindings } from '../bindings';
import { isEnterActivatedTarget, isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';

type SpeechSource = 'composer' | 'panel';

export function useAvatarSpeech({
  active,
  canSpeak,
  feet,
  scale,
  tabId,
  onSay,
}: {
  // In Avatar mode, with a character on the canvas.
  active: boolean;
  // An Editor or a Participant (the session's `can.takePart`); a Viewer never speaks.
  canSpeak: boolean;
  // The character's feet, where a bubble's start is measured from.
  feet: AvatarPoint | null;
  // The character's size scale, so the bubble clears a tall character's head.
  scale: number;
  tabId: string;
  // Sends one message to the room; absent with no room (the bubble is still yours to see).
  onSay?: (say: { id: string; text: string; x: number; y: number }) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const speaking = active && canSpeak && feet !== null;

  // The composer belongs to the moment: leaving the mode, a tab switch or losing the right to speak closes it
  // (adjusted during render, so it never draws for a frame it should not).
  const [openOn, setOpenOn] = useState<string | null>(null);
  if (composerOpen && (!speaking || openOn !== tabId)) {
    setComposerOpen(false);
    setOpenOn(null);
  }

  const coolingUntil = lastSentAt === null ? 0 : lastSentAt + SPEECH_COOLDOWN_MS;
  const coolingDown = now < coolingUntil;
  // One re-render when the cooldown passes, so Send comes back without a keystroke.
  useEffect(() => {
    if (!coolingDown) return;
    const t = setTimeout(() => setNow(Date.now()), coolingUntil - now);
    return () => clearTimeout(t);
  }, [coolingDown, coolingUntil, now]);

  const openComposer = () => {
    if (!speaking) return;
    setComposerOpen(true);
    setOpenOn(tabId);
  };
  const closeComposer = () => {
    setComposerOpen(false);
    setOpenOn(null);
  };

  /** Sends `text`; answers whether it went (false while cooling down or blank). */
  const send = (raw: string, source: SpeechSource): boolean => {
    if (!speaking || !feet) return false;
    const text = clampSayText(raw).trim();
    if (!text) {
      if (source === 'composer') closeComposer();
      return false;
    }
    const at = Date.now();
    if (at < coolingUntil) {
      debugLog('[avatar-say] drop', { reason: 'cooldown' });
      return false;
    }
    const start = headPoint(feet, scale);
    const id = crypto.randomUUID();
    addOwnBubble({ id, tabId, text, x: start.x, y: start.y });
    onSay?.({ id, text, x: start.x, y: start.y });
    setLastSentAt(at);
    setNow(at);
    if (source === 'composer') closeComposer();
    debugLog('[avatar-say] send', { source });
    avatarBindings.track(
      'Canvas',
      'Used',
      source === 'panel' ? 'AvatarMessagePanel' : 'AvatarMessage',
    );
    return true;
  };

  // Enter opens the composer (docs/specs/008-canvas/avatar-mode.md "Typing a message"): a plain press, with
  // nothing else holding the keyboard, and no focused control (a button, a menu row, the tour's card) Enter acts on
  // itself. Claimed so no other Enter handler sees it.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.repeat || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
    if (!speaking || composerOpen) return;
    if (isTypingTarget(e.target) || isEnterActivatedTarget(e.target) || anyModalOpen()) return;
    e.preventDefault();
    e.stopPropagation();
    openComposer();
  });
  useEffect(() => {
    if (!speaking) return;
    const handler = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [speaking]);

  return {
    speaking,
    composerOpen: composerOpen && speaking,
    openComposer,
    closeComposer,
    send,
    coolingDown,
  };
}
