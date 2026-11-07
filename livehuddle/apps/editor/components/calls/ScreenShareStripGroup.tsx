'use client';

// The Screen Share group (docs/specs/012-collaboration/video-and-screen-bubbles.md "The screen share"): while this
// browser shares its screen, the avatar palette swaps the look's Gender, Clothes and Hair out for these, right after
// the call group (owner, 2026-11-06: "When I am sharing my screen, remove the customisation option for my character
// and use the space it frees up to move the sharing controls into the palette"). A Sharing indicator, then Stop
// Sharing. It replaced the floating "You are sharing your screen" bar, so the share's controls have one home. A local
// preview of a screen (the same spec's "Local preview") shows the same group, saying only you see it.
import { useContext, useSyncExternalStore } from 'react';
import { lucideScreenShareOff } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph } from '@livehuddle/ui';
import { callSelf, onCallSelf, useCallActions, useCallSelf } from '@/lib/calls/calls-store';
import { localOnly, selfScreen } from '@/lib/calls/local-preview';
import {
  STRIP_CONTROL_GLYPH,
  STRIP_CONTROL_LABEL,
  STRIP_CONTROL_NAMED,
  STRIP_TINT_BUTTON,
} from '@/components/chrome/toolbar-surface';
import { CallNames, Segment } from './CallSegment';

const StopIcon = lucideGlyph(lucideScreenShareOff, 16);

const sharingNow = () => selfScreen(callSelf()) === 'on';

/** Whether this browser is sharing (or previewing) its screen: one boolean, so the strip re-renders only when it flips. */
export function useScreenSharing(): boolean {
  return useSyncExternalStore(onCallSelf, sharingNow, () => false);
}

export function ScreenShareStripGroup() {
  const self = useCallSelf();
  const actions = useCallActions();
  const named = useContext(CallNames);
  if (selfScreen(self) !== 'on' || !actions) return null;
  const preview = localOnly(self, 'screen');
  const name = preview ? 'Only You' : 'Sharing';
  return (
    <div
      role="group"
      aria-label="Screen Share"
      data-share-group=""
      className="flex shrink-0 items-center gap-0.5"
    >
      <HoverCard
        title={preview ? 'Only You See Your Screen' : 'You Are Sharing Your Screen'}
        description={
          preview
            ? 'Nothing is sent: your screen shows only above your own head.'
            : 'The people near you see your screen in a bubble above your head.'
        }
      >
        <span
          role="status"
          aria-label={preview ? 'Only you see your screen' : 'You are sharing your screen'}
          data-share-status=""
          className={`${STRIP_TINT_BUTTON} cursor-default bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200 ${
            named ? STRIP_CONTROL_NAMED : STRIP_CONTROL_GLYPH
          }`}
        >
          <span aria-hidden className="relative flex size-2.5 shrink-0">
            <span className="absolute inset-0 rounded-full bg-rose-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative size-2.5 rounded-full bg-rose-500" />
          </span>
          {named ? (
            <span aria-hidden className={STRIP_CONTROL_LABEL}>
              {name}
            </span>
          ) : null}
        </span>
      </HoverCard>
      <Segment
        label="Stop Sharing"
        name="Stop Sharing"
        title="Stop Sharing"
        description={
          preview
            ? 'Close the preview of your screen.'
            : 'Stop sharing your screen. The people near you stop seeing it.'
        }
        icon={<StopIcon />}
        onClick={actions.toggleScreen}
        tone="muted"
      />
    </div>
  );
}
