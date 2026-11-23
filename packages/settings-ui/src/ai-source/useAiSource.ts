'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiKeyFailure } from '@liveworkspace/ai/key-failure';
import type { AiKeysAnswer } from '../account-panels/ai/ai-keys';
import type { SettingsRequest } from '../request';
import { AI_KEY_CHANGED_EVENT, aiSourceOf, type AiSourceLine } from './ai-source-model';

/** What the line tells the app's telemetry: Settings opened from it, and a key added after. Never which key. */
export type AiSourceEvent = 'opened' | 'key-added';

export type UseAiSourceOptions = {
  // The accounts API's account routes (the app's bearer door); null for a guest, who sees no line.
  request: SettingsRequest | null;
  // The item's team, for its key; null before an item exists, or for one in no team.
  teamId?: string | null;
  // A key's failure from the feature's last call (`ai_key_failed`'s `aiKey`), said on the line until the next change.
  failure?: AiKeyFailure | null;
  // Opens the Settings panel on its AI category, over whatever is open.
  openSettings: () => void;
  track?: (event: AiSourceEvent) => void;
};

export type AiSourceState = {
  // Null: nothing to say (a guest, or the state could not be read).
  line: AiSourceLine | null;
  // The line's action: Use Your Own Key, Change or Fix Key. Null where this person cannot change what applies.
  act: (() => void) | null;
};

/** The source line's state (ai-keys.md "The source line"): read once when it mounts and again each time Settings › AI
 *  says it changed something, so closing Settings needs no reload. No poll and no read on a closed line. */
export function useAiSource({
  request,
  teamId = null,
  failure = null,
  openSettings,
  track,
}: UseAiSourceOptions): AiSourceState {
  const [answer, setAnswer] = useState<AiKeysAnswer | 'loading' | 'error'>('loading');
  // A failure is said until Settings changes something after it: then the fresh answer is the truth.
  const [cleared, setCleared] = useState<AiKeyFailure | null>(null);
  // Bumped by each read and on unmount; only the newest read's answer applies.
  const latest = useRef(0);
  // Set when the action opened Settings on built-in AI, so a key added there is counted once.
  const openedOnBuiltIn = useRef(false);
  // The newest failure and telemetry, for the change event and the effects below, which outlive a render.
  const live = useRef({ failure, track });
  useEffect(() => {
    live.current = { failure, track };
  }, [failure, track]);

  const read = useCallback(async () => {
    if (!request) return;
    const mine = ++latest.current;
    const result = await request<AiKeysAnswer>('/ai-key');
    if (mine !== latest.current) return;
    setAnswer(result.ok ? result.data : 'error');
  }, [request]);

  useEffect(() => {
    void read();
    const changed = () => {
      setCleared(live.current.failure);
      void read();
    };
    window.addEventListener(AI_KEY_CHANGED_EVENT, changed);
    return () => {
      latest.current += 1;
      window.removeEventListener(AI_KEY_CHANGED_EVENT, changed);
    };
  }, [read]);

  const shown = failure && failure !== cleared ? failure : null;
  const line: AiSourceLine | null = !request
    ? null
    : answer === 'loading'
      ? { kind: 'loading' }
      : answer === 'error'
        ? null
        : aiSourceOf(answer, teamId, shown);

  const kind = line?.kind;
  useEffect(() => {
    if (kind === 'key' && openedOnBuiltIn.current) {
      openedOnBuiltIn.current = false;
      live.current.track?.('key-added');
    }
  }, [kind]);

  const canAct = line !== null && line.kind !== 'loading' && line.canChange;
  const act = useCallback(() => {
    openedOnBuiltIn.current = kind === 'built-in';
    live.current.track?.('opened');
    openSettings();
  }, [kind, openSettings]);

  return { line, act: canAct ? act : null };
}
