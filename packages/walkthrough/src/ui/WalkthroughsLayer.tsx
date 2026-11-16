'use client';

// Everything a walkthrough draws over the canvas (liveworkspace/docs/specs/006-media/walkthroughs.md): the recording
// dock and the presenter's live bubble, the count, the player, and a short line after a save or a failed open. An
// app mounts it once over its canvas area (`absolute inset-0`); it takes no presses of its own outside its cards.

import { CloseIcon } from '@liveworkspace/ui';
import { useEffect } from 'react';
import type { Walkthroughs } from '../useWalkthroughs';
import { LiveBubble } from './Bubble';
import { Player } from './Player';
import { Countdown, RecordDock } from './RecordDock';

// The few animations the walkthroughs use, defined once here rather than in each app's Tailwind theme.
const KEYFRAMES = `
@keyframes walkthrough-count{0%{transform:scale(.6);opacity:0}25%{transform:scale(1);opacity:1}85%{opacity:1}100%{transform:scale(1.15);opacity:0}}
@keyframes walkthrough-upload{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
@keyframes walkthrough-ring{0%{transform:scale(.85);opacity:1}100%{transform:scale(1.12);opacity:0}}
`;

const NOTICE_MS = 4000;

export function WalkthroughsLayer({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const { recorder, player, notice, dismissNotice, host } = walkthroughs;
  const phase = recorder.phase;
  const live =
    recorder.stream && recorder.stream.getVideoTracks().length > 0 && phase.kind !== 'review'
      ? recorder.stream
      : null;
  const failed = player.phase.kind === 'failed' ? player.phase.message : null;
  const line = failed ?? notice;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (phase.kind === 'off' && player.phase.kind === 'off' && !line) return null;
  return (
    <div data-walkthroughs-layer="" className="pointer-events-none absolute inset-0 z-40">
      <style>{KEYFRAMES}</style>
      {live ? <LiveBubble stream={live} corner={recorder.corner} /> : null}
      {phase.kind === 'countdown' ? <Countdown n={phase.n} /> : null}
      <RecordDock walkthroughs={walkthroughs} />
      {player.phase.kind === 'ready' ? (
        <Player loaded={player.phase} host={host} onClose={player.close} />
      ) : null}
      {line && phase.kind === 'off' && player.phase.kind !== 'ready' ? (
        <div className="absolute inset-x-0 bottom-16 flex justify-center px-4">
          <p
            role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900/90 py-1.5 pl-3.5 pr-1.5 text-[12px] text-white shadow-lg backdrop-blur"
          >
            {line}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={failed ? player.close : dismissNotice}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <CloseIcon size={10} />
            </button>
          </p>
        </div>
      ) : null}
    </div>
  );
}
