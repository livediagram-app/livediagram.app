'use client';

import { useEffect, useState } from 'react';
import {
  youtubeEmbedUrl,
  youtubePosterUrl,
  youtubeVideoId,
  type VideoElement,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

// Inner content of a video element (spec/114): a YouTube poster frame with a
// play button, which swaps for the real player when pressed.
//
// The iframe is NOT mounted until play, and that is the whole design:
//
// - A tab with eight videos would otherwise open eight YouTube players on
//   load, each pulling a megabyte-plus of player JavaScript before anyone
//   watched anything.
// - An iframe swallows every pointer event inside its rectangle, so an
//   always-mounted player would be a hole in the canvas you could not drag,
//   select, or marquee over.
// - youtube-nocookie.com sets nothing until playback starts, so opening a
//   diagram that contains a video is not a tracked visit. The repo is public
//   and self-hostable (spec/03); a self-hoster should not be silently
//   shipping their users to Google on page load.

export function VideoView({ element }: { element: VideoElement }) {
  const url = element.link?.kind === 'url' ? element.link.url : undefined;
  const videoId = youtubeVideoId(url);
  const [playing, setPlaying] = useState(false);
  // Whether the player is taking pointer events. Off by default so dragging
  // the element always works; the user turns it on to seek or change volume.
  const [controls, setControls] = useState(false);
  // Changing the link tears the player down. Without this, editing the URL of
  // a playing video would leave the OLD video playing behind the new poster.
  useEffect(() => {
    setPlaying(false);
    setControls(false);
  }, [videoId]);

  if (!videoId) {
    return <EmptyState url={url} />;
  }

  if (playing) {
    return (
      <div className="group relative h-full w-full overflow-hidden rounded-[inherit] bg-black">
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title="YouTube video"
          // `allow` is the modern feature-policy list YouTube's own embed
          // snippet uses; without `autoplay` here the autoplay=1 in the URL is
          // ignored and the user has to press play a second time.
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          // Pointer-inert by DEFAULT, even while playing and even while
          // selected. An iframe swallows every event inside its rectangle, so
          // an interactive one is a hole in the canvas: the element could not
          // be dragged, and tying it to selection only moved the problem
          // (clicking to drag selected it, which then made it interactive, so
          // the drag never started). The `controls` toggle below is the
          // deliberate way to hand the pointer over.
          className={`h-full w-full rounded-[inherit] border-0 ${
            controls ? '' : 'pointer-events-none'
          }`}
        />
        <PlayerControls
          controls={controls}
          onToggleControls={() => setControls((c) => !c)}
          onStop={() => {
            setControls(false);
            setPlaying(false);
          }}
        />
      </div>
    );
  }

  return (
    // The card itself is pointer-INERT, exactly like a link card's top half
    // (spec/40): the canvas owns press-drag-release on an element, and a
    // full-size click target here swallowed pointerdown so a drag never
    // started, then swallowed the release so one that did start never ended.
    // Only the play badge below opts back in.
    <div className="group relative h-full w-full overflow-hidden rounded-[inherit] bg-slate-900">
      {/* Poster from the static image host. `hqdefault` exists for every
          video, unlike maxresdefault, which 404s on older uploads. */}
      <img
        src={youtubePosterUrl(videoId)}
        alt=""
        aria-hidden
        // object-cover: hqdefault is 4:3 with black bars baked in, so
        // containing it inside a 16:9 box would show bars twice over.
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          // The one interactive target, and small on purpose: everything
          // around it stays draggable canvas.
          onClick={(e) => {
            // The canvas treats a click on an element as select-and-maybe-
            // drag; pressing play is neither.
            e.stopPropagation();
            setPlaying(true);
            track('Element', 'Used', 'Video');
          }}
          aria-label="Play video"
          // Sized against the CARD (the wrapper is inset-0), not its own
          // contents: the glyph inside is percentage-height, which needs a
          // parent with a height to resolve against.
          className="pointer-events-auto aspect-[68/48] h-[24%] min-h-[26px] cursor-pointer rounded-xl transition hover:scale-110"
        >
          <PlayBadge />
        </button>
      </div>
    </div>
  );
}

// The two controls a playing video needs, top-right and small: hand the
// pointer to the player, or stop and go back to the poster.
//
// They exist because the iframe is pointer-inert (see above). Without a way
// to turn that off there would be no seeking or volume; without Stop there
// would be no way to pause, since pausing means clicking the player.
function PlayerControls({
  controls,
  onToggleControls,
  onStop,
}: {
  controls: boolean;
  onToggleControls: () => void;
  onStop: () => void;
}) {
  return (
    <div
      // Inert strip, interactive buttons — same rule as the poster: anything
      // that isn't a control stays draggable canvas.
      //
      // Top-LEFT, not right: every element's link badge is pinned to the
      // top-right corner, and a video always has a link, so controls there sat
      // underneath it and were unclickable.
      className="pointer-events-none absolute left-1.5 top-1.5 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100"
    >
      <ControlButton
        onClick={onToggleControls}
        label={controls ? 'Lock the player (drag the video)' : 'Use the player controls'}
        active={controls}
      >
        {/* A pointer arrow: "the pointer goes to the player". */}
        <path d="M4 3l8 5-3.4 1.2L7.4 13z" fill="currentColor" stroke="none" />
      </ControlButton>
      <ControlButton onClick={onStop} label="Stop video">
        <rect x="4.5" y="4.5" width="7" height="7" rx="1.2" fill="currentColor" stroke="none" />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md backdrop-blur transition ${
        active ? 'bg-brand-500 text-white' : 'bg-black/60 text-white hover:bg-black/80'
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

// The YouTube play glyph: a rounded red lozenge with a white triangle. Drawn
// rather than imported so it inherits the canvas zoom like every other
// element and needs no network request of its own.
function PlayBadge() {
  return (
    <span className="pointer-events-none flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 68 48" className="h-full w-full drop-shadow-lg" aria-hidden>
        <path
          d="M66.5 7.5a8.6 8.6 0 0 0-6-6C55.1 0 34 0 34 0S12.9 0 7.5 1.5a8.6 8.6 0 0 0-6 6A90 90 0 0 0 0 24a90 90 0 0 0 1.5 16.5 8.6 8.6 0 0 0 6 6C12.9 48 34 48 34 48s21.1 0 26.5-1.5a8.6 8.6 0 0 0 6-6A90 90 0 0 0 68 24a90 90 0 0 0-1.5-16.5z"
          fill="#ff0000"
        />
        <path d="M27 34 45 24 27 14z" fill="#ffffff" />
      </svg>
    </span>
  );
}

// Two different problems, so two different messages: no link at all is a
// prompt to add one, whereas a link that isn't a YouTube URL is a mistake
// worth naming rather than silently rendering a broken poster.
function EmptyState({ url }: { url: string | undefined }) {
  return (
    <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[inherit] px-3 text-center">
      <span className="aspect-[68/48] h-8 opacity-60">
        <PlayBadge />
      </span>
      {url ? (
        <>
          <span className="text-[11px] font-medium text-slate-200">Not a YouTube link</span>
          <span className="w-full truncate text-[10px] text-slate-400">{url}</span>
        </>
      ) : (
        <span className="text-[11px] font-medium text-slate-300">
          Add a YouTube link — double-click
        </span>
      )}
    </div>
  );
}
