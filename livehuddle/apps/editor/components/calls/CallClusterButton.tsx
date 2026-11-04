'use client';

// Proximity audio's control in the bottom-right cluster, beside Avatar (docs/specs/012-collaboration/
// proximity-audio.md "Who is in a call" and "The microphone"). Before you join: one button, Join Audio (Listen In for
// a Viewer). Once in: a strip of the microphone, which mutes and unmutes and shows at a glance whether anyone hears
// you, and Leave Audio. Nothing at all while calls are off or there is nobody to talk to.
import type { ReactNode } from 'react';
import {
  lucideHeadphoneOff,
  lucideHeadphones,
  lucideMic,
  lucideMicOff,
} from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph } from '@livehuddle/ui';
import { ClusterStrip } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { CLUSTER_CONTROL_REST } from '@liveworkspace/workbench/components/canvas/cluster-strip';
import { useDockNames } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import { useCallActions, useCallSelf, type CallSelf } from '@/lib/calls/calls-store';

const MicIcon = lucideGlyph(lucideMic, 16);
const MicOffIcon = lucideGlyph(lucideMicOff, 16);
const HeadphonesIcon = lucideGlyph(lucideHeadphones, 16);
const LeaveIcon = lucideGlyph(lucideHeadphoneOff, 16);

/** What the microphone shows: the indicator's four states, plus a listener's. */
export type MicIndicator = 'live' | 'nobody-near' | 'muted' | 'blocked' | 'closed' | 'listening';

export function micIndicator(self: CallSelf): MicIndicator {
  if (!self.canSpeak) return 'listening';
  if (self.mic === 'blocked') return 'blocked';
  if (self.muted) return 'muted';
  if (self.mic === 'closed') return 'closed';
  return self.someoneNear ? 'live' : 'nobody-near';
}

const INDICATOR_TEXT: Record<MicIndicator, { title: string; description: string }> = {
  live: { title: 'Live', description: 'The people near you hear you. Press to mute.' },
  'nobody-near': {
    title: 'Nobody Near',
    description: 'Your microphone is on, but nobody is close enough to hear you. Press to mute.',
  },
  muted: { title: 'Muted', description: 'Nobody hears you. Press to unmute.' },
  blocked: {
    title: 'Mic Blocked',
    description:
      'Your browser refused the microphone. Allow it from the address bar, then join again. You still hear everyone.',
  },
  closed: {
    title: 'Mic Off',
    description:
      'Nobody else is on this tab, so your microphone is off. It opens when somebody arrives.',
  },
  listening: {
    title: 'Listening',
    description: 'You hear the people near you. Your link lets you listen, not speak.',
  },
};

function Segment(props: {
  label: string;
  name: string;
  title: string;
  description: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  divided?: boolean;
  tone?: 'rest' | 'live' | 'warn' | 'muted';
  children?: ReactNode;
}) {
  const named = useDockNames();
  const tone =
    props.tone === 'live'
      ? 'text-brand-700 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-500/15'
      : props.tone === 'warn'
        ? 'text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10'
        : props.tone === 'muted'
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10'
          : CLUSTER_CONTROL_REST;
  return (
    <HoverCard title={props.title} description={props.description}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={props.label}
        aria-pressed={props.pressed}
        className={`relative flex h-11 items-center ${props.onClick ? 'cursor-pointer' : 'cursor-default'} justify-center transition disabled:cursor-wait disabled:opacity-60 ${
          named ? 'gap-2 px-3.5 text-sm font-medium' : 'w-11'
        } ${props.divided ? 'border-l border-slate-100 dark:border-slate-800' : ''} ${tone}`}
      >
        {props.children}
        {props.icon}
        {named ? <span aria-hidden>{props.name}</span> : null}
      </button>
    </HoverCard>
  );
}

// A soft ring round the microphone while somebody hears you, breathing with your own level.
function LiveRing({ level }: { level: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-1.5 rounded-md ring-2 ring-brand-400/60 transition-[box-shadow,opacity] duration-150 dark:ring-brand-300/50"
      style={{ opacity: 0.45 + level * 0.14 }}
    />
  );
}

export function CallClusterButton() {
  const self = useCallSelf();
  const actions = useCallActions();
  if (!self.available || !actions) return null;

  if (self.phase === 'off' || self.phase === 'joining' || self.phase === 'error') {
    const joining = self.phase === 'joining';
    const name = self.canSpeak ? 'Join Audio' : 'Listen In';
    return (
      <ClusterStrip dataTourId="call-button">
        <Segment
          label={name}
          name={joining ? 'Joining…' : name}
          title={self.phase === 'error' ? 'Audio Unavailable' : name}
          description={
            self.phase === 'error'
              ? 'Audio could not start. Press to try again.'
              : self.canSpeak
                ? 'Talk with the people near your character. Walk away to leave a conversation.'
                : 'Hear the people near your character. Your link lets you listen, not speak.'
          }
          icon={self.canSpeak ? <MicIcon /> : <HeadphonesIcon />}
          onClick={actions.join}
          disabled={joining}
          tone={self.phase === 'error' ? 'warn' : 'rest'}
        />
      </ClusterStrip>
    );
  }

  const indicator = micIndicator(self);
  const text = INDICATOR_TEXT[indicator];
  const mutable = indicator !== 'listening' && indicator !== 'blocked';
  return (
    <ClusterStrip dataTourId="call-button">
      <Segment
        label={self.muted ? 'Unmute' : indicator === 'listening' ? 'Listening' : 'Mute'}
        name={text.title}
        title={text.title}
        description={text.description}
        icon={
          indicator === 'listening' ? (
            <HeadphonesIcon />
          ) : indicator === 'muted' || indicator === 'blocked' ? (
            <MicOffIcon />
          ) : (
            <MicIcon />
          )
        }
        onClick={mutable ? actions.toggleMute : undefined}
        pressed={mutable ? self.muted : undefined}
        tone={
          indicator === 'live'
            ? 'live'
            : indicator === 'blocked'
              ? 'warn'
              : indicator === 'muted'
                ? 'muted'
                : 'rest'
        }
      >
        {indicator === 'live' ? <LiveRing level={self.level} /> : null}
      </Segment>
      <Segment
        label="Leave Audio"
        name="Leave"
        title="Leave Audio"
        description="Stop hearing and being heard. Your microphone is released."
        icon={<LeaveIcon />}
        onClick={actions.leave}
        divided
      />
    </ClusterStrip>
  );
}
