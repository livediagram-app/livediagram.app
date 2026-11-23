'use client';

// The player (liveworkspace/docs/specs/006-media/walkthroughs.md "Playing"): the recording's media drives the clock;
// each frame the timeline says where the tab, the slide, the camera and the pointer stand, and the canvas follows. A
// pan, zoom or press of the viewer's own pauses it and leaves the view with them until Resume.

import { CloseIcon, HoverCard, useEscape } from '@liveworkspace/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { contentOf, elementBox, screenPoint, sizeOf } from '../bridge';
import type { WalkthroughHost } from '../host';
import { fitView, formatClock, type PlayState } from '../timeline';
import type { Loaded } from '../usePlayer';
import { PlaybackBubble, VoiceChip } from './Bubble';
import { PauseIcon, PlayIcon } from './icons';

const SPEEDS = [1, 1.5, 2] as const;
const SKIP_MS = 5000;
// How often the bar's clock re-renders; the canvas and the pointer follow every frame without rendering.
const BAR_MS = 250;

type Ring = { key: string; x: number; y: number; w: number; h: number };

export function Player({
  loaded,
  host,
  onClose,
}: {
  loaded: Loaded;
  host: WalkthroughHost;
  onClose: () => void;
}) {
  const { walkthrough, events, timeline, url, edited } = loaded;
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const hostRef = useRef(host);
  useEffect(() => {
    hostRef.current = host;
  });
  const [playing, setPlaying] = useState(false);
  const [looking, setLooking] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [rings, setRings] = useState<Ring[]>([]);
  const shown = useRef<{ tab: string | null; slide: string | null; rings: string }>({
    tab: null,
    slide: null,
    rings: '',
  });
  // Set while the player itself moves the view, so its own change is not read as the viewer's.
  const moving = useRef(false);

  // Puts the canvas where the recording was at `t`.
  const apply = useCallback(
    (t: number) => {
      const h = hostRef.current;
      const state: PlayState = timeline.at(t);
      const last = shown.current;
      if (state.tab !== last.tab) {
        last.tab = state.tab;
        h.showTab(state.tab);
      }
      const slide = state.slide?.slide ?? null;
      if (h.slides && slide !== last.slide) {
        last.slide = slide;
        if ((h.slides.current ?? null) !== slide) h.slides.show(slide);
      }
      const root = h.canvasRoot();
      const content = contentOf(root);
      // While a slide is up it frames itself; the camera path waits.
      if (content && state.view && !(h.slides && slide)) {
        const { w, h: height } = sizeOf(content);
        moving.current = true;
        h.viewport.setView(fitView(state.view, w, height));
        moving.current = false;
      }
      const box = frame.current;
      if (dot.current) {
        const at = content && box && state.cursor ? screenPoint(content, box, state.cursor) : null;
        dot.current.style.opacity = at ? '1' : '0';
        if (at) dot.current.style.transform = `translate(${at.x}px, ${at.y}px)`;
      }
      const key = state.points.map((p) => `${p.id}@${p.t}`).join(',');
      if (key !== last.rings) {
        last.rings = key;
        setRings(
          root && box
            ? state.points.flatMap((p) => {
                const r = elementBox(root, box, p.id, h.hideable?.marks);
                return r ? [{ key: `${p.id}@${p.t}`, ...r }] : [];
              })
            : [],
        );
      }
    },
    [timeline],
  );

  // The frame loop while playing.
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    let barAt = 0;
    const step = (now: number) => {
      const el = media.current;
      if (el) {
        const t = el.currentTime * 1000;
        apply(t);
        if (now - barAt >= BAR_MS) {
          barAt = now;
          setTime(t);
        }
      }
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [playing, apply]);

  // The viewer's own pan, zoom or press pauses it.
  useEffect(() => {
    if (!playing) return;
    const root = hostRef.current.canvasRoot();
    if (!root) return;
    const own = (e: Event) => {
      // The player's own bar and bubble sit over the canvas; pressing them is not looking around.
      if (moving.current || frame.current?.contains(e.target as Node)) return;
      media.current?.pause();
      setLooking(true);
    };
    root.addEventListener('pointerdown', own, { capture: true });
    root.addEventListener('wheel', own, { capture: true, passive: true });
    return () => {
      root.removeEventListener('pointerdown', own, { capture: true });
      root.removeEventListener('wheel', own, { capture: true });
    };
  }, [playing]);

  const play = useCallback(() => {
    const el = media.current;
    if (!el) return;
    if (ended) el.currentTime = 0;
    setEnded(false);
    setLooking(false);
    apply(el.currentTime * 1000);
    void el.play().catch(() => setPlaying(false));
  }, [apply, ended]);
  const pause = useCallback(() => media.current?.pause(), []);
  const seek = useCallback(
    (t: number) => {
      const el = media.current;
      if (!el) return;
      const next = Math.max(0, Math.min(timeline.durationMs, t));
      el.currentTime = next / 1000;
      setTime(next);
      setEnded(false);
      setLooking(false);
      apply(next);
    },
    [apply, timeline.durationMs],
  );

  // Starts playing as it opens.
  useEffect(() => {
    apply(0);
    void media.current?.play().catch(() => undefined);
  }, [apply]);

  useEffect(() => {
    if (media.current) media.current.playbackRate = speed;
  }, [speed]);

  useEscape(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (playing) pause();
        else play();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        seek(time + (e.key === 'ArrowLeft' ? -SKIP_MS : SKIP_MS));
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [playing, play, pause, seek, time]);

  const camera = walkthrough.camera;
  const mediaEl = camera ? (
    <video
      ref={media}
      src={url}
      playsInline
      className="h-full w-full object-cover"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => {
        setPlaying(false);
        setEnded(true);
        setTime(timeline.durationMs);
      }}
    />
  ) : (
    <audio
      ref={media}
      src={url}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => {
        setPlaying(false);
        setEnded(true);
        setTime(timeline.durationMs);
      }}
    />
  );

  const status = looking
    ? 'Paused. Look around, then Resume.'
    : edited
      ? 'Edited since recording. It plays over the canvas as it is now.'
      : null;

  return (
    <div
      ref={frame}
      data-walkthrough-player=""
      className="pointer-events-none absolute inset-0 z-40"
    >
      {camera ? (
        <PlaybackBubble corner={events.corner}>{mediaEl}</PlaybackBubble>
      ) : (
        <>
          {mediaEl}
          <VoiceChip
            corner={events.corner}
            name={walkthrough.mine ? 'You' : (walkthrough.author ?? null)}
            fallback={walkthrough.title}
            playing={playing}
          />
        </>
      )}
      {/* The presenter's pointer: a soft dot, moved every frame without rendering. */}
      <div
        ref={dot}
        aria-hidden
        className="absolute left-0 top-0 -ml-2 -mt-2 h-4 w-4 rounded-full bg-rose-500/80 opacity-0 shadow-[0_0_0_4px_rgb(244_63_94_/_0.2)] transition-opacity duration-150"
      />
      {rings.map((r) => (
        <span
          key={r.key}
          aria-hidden
          style={{ left: r.x - 6, top: r.y - 6, width: r.w + 12, height: r.h + 12 }}
          className="absolute animate-[walkthrough-ring_0.9s_ease-out_forwards] rounded-xl border-2 border-rose-500 motion-reduce:animate-none"
        />
      ))}
      <div className="absolute inset-x-0 bottom-16 flex flex-col items-center gap-2 px-4">
        {status ? (
          <p
            role="status"
            className="pointer-events-auto rounded-full bg-slate-900/85 px-3 py-1 text-[12px] text-white shadow-lg backdrop-blur"
          >
            {status}
          </p>
        ) : null}
        <PlayerBar
          title={walkthrough.title}
          playing={playing}
          looking={looking}
          time={time}
          durationMs={timeline.durationMs}
          marks={timeline.marks}
          speed={speed}
          onPlay={play}
          onPause={pause}
          onSeek={seek}
          onSpeed={setSpeed}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

function PlayerBar({
  title,
  playing,
  looking,
  time,
  durationMs,
  marks,
  speed,
  onPlay,
  onPause,
  onSeek,
  onSpeed,
  onClose,
}: {
  title: string;
  playing: boolean;
  looking: boolean;
  time: number;
  durationMs: number;
  marks: Loaded['timeline']['marks'];
  speed: (typeof SPEEDS)[number];
  onPlay: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
  onSpeed: (s: (typeof SPEEDS)[number]) => void;
  onClose: () => void;
}) {
  const span = Math.max(1, durationMs);
  return (
    <section
      aria-label={`Walkthrough: ${title}`}
      data-walkthrough-bar=""
      className="pointer-events-auto flex w-[min(36rem,100%)] items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 py-2 pl-2 pr-2 shadow-2xl shadow-slate-900/15 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/40"
    >
      {playing ? (
        <HoverCard title="Pause" description="Space">
          <button
            type="button"
            aria-label="Pause"
            onClick={onPause}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-700 text-white transition hover:bg-brand-800"
          >
            <PauseIcon size={14} />
          </button>
        </HoverCard>
      ) : (
        <HoverCard title={looking ? 'Resume' : 'Play'} description="Space">
          <button
            type="button"
            aria-label={looking ? 'Resume' : 'Play'}
            onClick={onPlay}
            className={`flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-brand-700 text-white transition hover:bg-brand-800 ${
              looking ? 'px-3.5 text-[12px] font-medium' : 'w-9'
            }`}
          >
            <PlayIcon size={13} className={looking ? '' : 'translate-x-px'} />
            {looking ? <span className="text-optical-line">Resume</span> : null}
          </button>
        </HoverCard>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">
            {title}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            {formatClock(time)} / {formatClock(durationMs)}
          </span>
        </div>
        <div className="relative flex h-4 items-center">
          <span className="absolute inset-x-0 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
          <span
            className="absolute left-0 h-1 rounded-full bg-brand-600"
            style={{ width: `${(Math.min(time, span) / span) * 100}%` }}
          />
          {marks.map((m) => (
            <span
              key={`${m.kind}-${m.t}`}
              title={m.label}
              className={`absolute h-2.5 w-0.5 -translate-x-1/2 rounded-full ${
                m.kind === 'tab' ? 'bg-slate-500 dark:bg-slate-300' : 'bg-brand-400'
              }`}
              style={{ left: `${(m.t / span) * 100}%` }}
            />
          ))}
          <input
            type="range"
            aria-label="Position"
            min={0}
            max={durationMs}
            step={100}
            value={Math.min(time, durationMs)}
            aria-valuetext={`${formatClock(time)} of ${formatClock(durationMs)}`}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 h-4 w-full cursor-pointer opacity-0"
          />
        </div>
      </div>
      <HoverCard title="Speed">
        <button
          type="button"
          aria-label={`Speed ${speed}x`}
          onClick={() => onSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!)}
          className="h-8 min-w-[2.75rem] shrink-0 cursor-pointer rounded-lg px-2 text-[12px] font-semibold tabular-nums text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {speed}x
        </button>
      </HoverCard>
      <HoverCard title="Close" description="Esc">
        <button
          type="button"
          aria-label="Close walkthrough"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CloseIcon size={12} />
        </button>
      </HoverCard>
    </section>
  );
}
