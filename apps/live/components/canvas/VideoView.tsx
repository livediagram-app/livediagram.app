'use client';

import { useEffect, useState } from 'react';
import {
  EMBED_PROVIDER_HINT,
  EMBED_PROVIDER_LABEL,
  embedTargetFor,
  type EmbedProvider,
  type EmbedTarget,
  type VideoElement,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { useFrameBlocked } from '@/components/canvas/use-frame-blocked';

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
  const target = embedTargetFor(url);
  const [playing, setPlaying] = useState(false);
  // Whether the player is taking pointer events. Off by default so dragging
  // the element always works; the user turns it on to seek or change volume.
  const [controls, setControls] = useState(false);
  // Website embeds can be refused by the site itself (spec/133); the frame
  // says nothing when that happens, so we watch for it.
  const frame = useFrameBlocked(playing ? target?.embedUrl : undefined);
  // Changing the link tears the player down. Without this, editing the URL of
  // a playing video would leave the OLD video playing behind the new poster.
  useEffect(() => {
    setPlaying(false);
    setControls(false);
  }, [target?.embedUrl]);

  if (!target) {
    return <EmptyState url={url} provider={element.embedProvider} />;
  }

  if (playing) {
    return (
      <div className="group relative h-full w-full overflow-hidden rounded-[inherit] bg-black">
        <iframe
          ref={frame.ref}
          onLoad={frame.onLoad}
          src={target.embedUrl}
          title={`${target.label} embed`}
          // `allow` is the modern feature-policy list YouTube's own embed
          // snippet uses; without `autoplay` here the autoplay=1 in the URL is
          // ignored and the user has to press play a second time.
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          // Arbitrary websites (spec/133) get a sandbox; the named providers
          // do not, because a sandbox breaks several of them and we chose
          // those hosts deliberately.
          //
          // The permission that MATTERS is the one absent from this list:
          // `allow-top-navigation`. Without it a framed page cannot navigate
          // the editor tab out from under the user, which is the one thing an
          // embed of "any URL you like" must not be able to do. Scripts and
          // forms stay on, since a page without them is not a page.
          // (`allow-same-origin` is safe here: it means same-origin with the
          // FRAMED site, which is never us.)
          sandbox={
            target.provider === 'website'
              ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox'
              : undefined
          }
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
        {/* Over the frame, not instead of it: the blank error page underneath
            is what the user would otherwise be staring at. */}
        {frame.failed ? <BlockedNotice target={target} /> : null}
        <PlayerControls
          controls={controls}
          onToggleControls={() => setControls((c) => !c)}
          onStop={() => {
            setControls(false);
            setPlaying(false);
            frame.reset();
          }}
          openUrl={target.provider === 'website' ? target.embedUrl : undefined}
        />
      </div>
    );
  }

  // A provider with no published thumbnail (everything but YouTube) gets a
  // named card instead of a poster. The rule that matters is unchanged:
  // nothing third-party loads until the user asks.
  if (!target.posterUrl) {
    return <LoadCard target={target} onLoad={() => setPlaying(true)} />;
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
        src={target.posterUrl}
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

// Shown when a frame produced no load event at all (spec/133) — a hung or
// unreachable site.
//
// Deliberately hedged: a REFUSED frame is indistinguishable from a working one
// (see use-frame-blocked for the measurements), so this cannot promise which
// of the two happened. It names the likely cause, names the site, and offers
// the one thing that always works: opening the page properly.
function BlockedNotice({ target }: { target: EmbedTarget }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[inherit] bg-slate-900/95 px-5 text-center">
      <span className="text-slate-400">
        <BlockedGlyph />
      </span>
      <span className="text-[11px] font-medium text-slate-200">
        {target.label} isn&apos;t loading
      </span>
      <span className="max-w-full text-[10px] leading-snug text-slate-400">
        Many sites refuse to be shown inside another page, and some are just slow. Either way the
        site decides, not the canvas.
      </span>
      <a
        href={target.embedUrl}
        target="_blank"
        rel="noreferrer noopener"
        // The one live target on an otherwise inert overlay, so the element
        // stays draggable everywhere else.
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto mt-1 cursor-pointer rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-white/25"
      >
        Open in a new tab
      </a>
    </div>
  );
}

// A frame with a slash through it: "this will not go in here".
function BlockedGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 8.5h18" />
      <path d="m5 20.5 14-16" />
    </svg>
  );
}

// The pre-load card for a provider that publishes no thumbnail: its name, and
// a button. Deliberately not an auto-mounted iframe — see the header.
function LoadCard({ target, onLoad }: { target: EmbedTarget; onLoad: () => void }) {
  return (
    <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 rounded-[inherit] px-3 text-center">
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
        {target.label}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onLoad();
          track('Element', 'Used', 'Video');
        }}
        className="pointer-events-auto cursor-pointer rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-white/25"
      >
        Load embed
      </button>
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
  openUrl,
}: {
  controls: boolean;
  onToggleControls: () => void;
  onStop: () => void;
  // Website embeds only (spec/133): the escape hatch for a site that refuses
  // to be framed. Always offered rather than shown on detection, because a
  // refusal is indistinguishable from a successful load (see use-frame-blocked).
  openUrl?: string;
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
      {openUrl ? (
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Open this page in a new tab"
          title="Blank? Open this page in a new tab"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-slate-900/70 text-white transition hover:bg-slate-900/90"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M9 3.5h3.5V7M12.5 3.5 8 8"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11.5 9.5v2.2a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h2.2"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </a>
      ) : null}
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
// prompt to add one, whereas a link we can't embed is a mistake worth naming
// with the list of what WOULD work.
//
// Neutral glyph, not the YouTube badge: this element carries Figma files and
// Google Docs too (spec/121), and a red play button on an empty card told the
// user it was a video element and nothing else.
function EmptyState({
  url,
  provider,
}: {
  url: string | undefined;
  provider: EmbedProvider | undefined;
}) {
  // Name the service this embed was made for, when it was made from one of
  // the provider tiles (spec/121); the generic list is the fallback.
  const named = provider ? EMBED_PROVIDER_LABEL[provider] : null;
  return (
    <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[inherit] px-4 text-center">
      <EmbedGlyph />
      {url ? (
        <>
          <span className="text-[11px] font-medium text-slate-200">Can&apos;t embed that link</span>
          <span className="w-full truncate text-[10px] text-slate-400">{url}</span>
        </>
      ) : (
        <>
          <span className="text-[11px] font-medium text-slate-200">
            {/* "Add a Website link" reads like a typo; a website has an
                address, not a link. */}
            {provider === 'website'
              ? 'Add a web address'
              : named
                ? `Add a ${named} link`
                : 'Add a link'}{' '}
            — double-click
          </span>
          <span className="text-[10px] leading-snug text-slate-400">
            {provider
              ? EMBED_PROVIDER_HINT[provider]
              : 'YouTube, Vimeo, Loom, Figma, Google Docs, or any website'}
          </span>
        </>
      )}
    </div>
  );
}

// A framed play triangle: "something loads in here", without claiming which
// service it comes from.
function EmbedGlyph() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-slate-400 opacity-80"
    >
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M2.5 8h19" />
      <path d="M10.5 12.2v3.6l3.2-1.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}
