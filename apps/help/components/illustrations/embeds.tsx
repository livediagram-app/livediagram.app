// Embed scenes for the Embeds and Website embeds articles (docs/specs/018-help/help-app.md, drawing
// docs/specs/009-elements/youtube-video.md, docs/specs/009-elements/embed-providers.md and
// docs/specs/009-elements/website-embed.md).
//
// An embed card is dark in both appearances (a video's letterbox, a named card
// with its Load embed button), so every card sits in `help-art-as-drawn`. The
// controls are the editor's: the play button on a YouTube poster, Load embed on
// every other service, and, while it runs, two small buttons top-left (hand the
// pointer to the player; stop) beside the link badge every linked element wears
// top-right. A website embed adds a third, open in a new tab.

import { Scene, Label } from './primitives';

/** The link badge every linked element carries in its top-right corner. */
function LinkBadge({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9} className="fill-white stroke-slate-300" strokeWidth={1.2} />
      <path
        d={`M${x - 3.5} ${y + 1} l2.4 -2.4a2 2 0 0 1 2.8 2.8l-1.2 1.2M${x + 3.5} ${y - 1}l-2.4 2.4a2 2 0 0 1 -2.8 -2.8l1.2 -1.2`}
        className="fill-none stroke-slate-500"
        strokeWidth={1.3}
      />
    </g>
  );
}

/** A small dark control button, the way a running embed draws them. */
function Control({
  x,
  y,
  on = false,
  kind,
}: {
  x: number;
  y: number;
  on?: boolean;
  kind: 'pointer' | 'stop' | 'open';
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={20}
        height={20}
        rx={5}
        className={on ? 'fill-brand-500' : 'fill-slate-900'}
        fillOpacity={on ? 1 : 0.7}
      />
      {kind === 'pointer' && (
        <path d={`M${x + 6} ${y + 5}l8 5-3.4 1.2-1.2 3.8z`} className="fill-white" />
      )}
      {kind === 'stop' && (
        <rect x={x + 6} y={y + 6} width={8} height={8} rx={1.4} className="fill-white" />
      )}
      {kind === 'open' && (
        <path
          d={`M${x + 11} ${y + 5.5}h3.5v3.5M${x + 14.5} ${y + 5.5}l-4.5 4.5M${x + 13.5} ${y + 11.5}v2.2a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h2.2`}
          className="fill-none stroke-white"
          strokeWidth={1.3}
        />
      )}
    </g>
  );
}

/** Before anything loads: a YouTube card shows the video's poster and waits
 *  for play; every other service shows a named card with Load embed. */
export function EmbedCardsIdle() {
  return (
    <Scene w={420} h={168}>
      <g className="help-art-as-drawn">
        {/* YouTube: the poster frame and the play button. */}
        <rect x={16} y={24} width={188} height={106} rx={8} className="fill-slate-800" />
        <rect
          x={16}
          y={24}
          width={188}
          height={106}
          rx={8}
          className="fill-brand-200"
          fillOpacity={0.25}
        />
        <path
          d="M16 112 L70 72 L104 98 L140 64 L204 112 V122 a8 8 0 0 1 -8 8 H24 a8 8 0 0 1 -8 -8 Z"
          className="fill-slate-600"
        />
        <rect x={92} y={63} width={36} height={26} rx={8} className="fill-rose-500" />
        <path d="M105 69 L117 76 L105 83 Z" className="fill-white" />
        {/* Figma: the named card and Load embed. */}
        <rect x={216} y={24} width={188} height={106} rx={8} className="fill-slate-800" />
        <rect
          x={290}
          y={52}
          width={40}
          height={16}
          rx={8}
          className="fill-white"
          fillOpacity={0.12}
        />
        <Label x={310} y={60.5} anchor="middle" size={10} weight={700} className="fill-slate-300">
          FIGMA
        </Label>
        <rect
          x={270}
          y={78}
          width={80}
          height={24}
          rx={6}
          className="fill-white"
          fillOpacity={0.16}
        />
        <Label x={310} y={90.5} anchor="middle" size={11} weight={500} className="fill-white">
          Load embed
        </Label>
      </g>
      <LinkBadge x={198} y={30} />
      <LinkBadge x={398} y={30} />
      <Label x={110} y={150} anchor="middle" size={11} tone="muted">
        YouTube: press play
      </Label>
      <Label x={310} y={150} anchor="middle" size={11} tone="muted">
        Everything else: Load embed
      </Label>
    </Scene>
  );
}

/** A running embed: the player ignores the pointer until you hand it over
 *  with the first control; the second stops it. */
export function EmbedPlayerControls() {
  const x = 110;
  const y = 30;
  const w = 220;
  const h = 124;
  return (
    <Scene w={420} h={206}>
      <g className="help-art-as-drawn">
        <rect x={x} y={y} width={w} height={h} rx={8} className="fill-slate-900" />
        <rect
          x={x + 14}
          y={y + h - 20}
          width={w - 28}
          height={4}
          rx={2}
          className="fill-slate-600"
        />
        <rect
          x={x + 14}
          y={y + h - 20}
          width={(w - 28) * 0.35}
          height={4}
          rx={2}
          className="fill-rose-500"
        />
        <Control x={x + 6} y={y + 6} kind="pointer" />
        <Control x={x + 30} y={y + 6} kind="stop" />
      </g>
      <LinkBadge x={x + w - 6} y={y + 6} />
      {/* Callouts naming each control by its hover label. */}
      <path
        d={`M${x + 16} ${y + 6} V${y - 10} H${x - 8}`}
        className="fill-none stroke-slate-300"
        strokeWidth={1.2}
      />
      <Label x={x - 12} y={y - 10} anchor="end" size={10} tone="body">
        Use the player
      </Label>
      <Label x={x - 12} y={y + 3} anchor="end" size={10} tone="body">
        controls
      </Label>
      <path
        d={`M${x + 40} ${y + 26} V${y + h + 22} H${x + 60}`}
        className="fill-none stroke-slate-300"
        strokeWidth={1.2}
      />
      <Label x={x + 64} y={y + h + 22} size={10} tone="body">
        Stop video
      </Label>
      <path
        d={`M${x + w + 3} ${y + 6} H${x + w + 14}`}
        className="fill-none stroke-slate-300"
        strokeWidth={1.2}
      />
      <Label x={x + w + 18} y={y + 2} size={10} tone="body">
        Open the
      </Label>
      <Label x={x + w + 18} y={y + 15} size={10} tone="body">
        original
      </Label>
    </Scene>
  );
}

/** Website embeds: the card is labelled with the host rather than the word
 *  "Website", and while it runs it carries a third control to open the page
 *  in a new tab. */
export function WebsiteEmbedCards() {
  return (
    <Scene w={420} h={168}>
      <g className="help-art-as-drawn">
        {/* Waiting: the host chip and Load embed. */}
        <rect x={16} y={24} width={188} height={106} rx={8} className="fill-slate-800" />
        <rect
          x={56}
          y={52}
          width={108}
          height={16}
          rx={8}
          className="fill-white"
          fillOpacity={0.12}
        />
        <Label x={110} y={60.5} anchor="middle" size={10} weight={700} className="fill-slate-300">
          STATUS.EXAMPLE.COM
        </Label>
        <rect
          x={70}
          y={78}
          width={80}
          height={24}
          rx={6}
          className="fill-white"
          fillOpacity={0.16}
        />
        <Label x={110} y={90.5} anchor="middle" size={11} weight={500} className="fill-white">
          Load embed
        </Label>
        {/* Loaded: the page, with three controls top-left. */}
        <rect
          x={216}
          y={24}
          width={188}
          height={106}
          rx={8}
          className="fill-white stroke-slate-300"
          strokeWidth={1.2}
        />
        <rect x={228} y={58} width={110} height={8} rx={4} className="fill-slate-300" />
        <rect x={228} y={74} width={160} height={6} rx={3} className="fill-slate-200" />
        <rect x={228} y={86} width={140} height={6} rx={3} className="fill-slate-200" />
        <circle cx={234} cy={108} r={5} className="fill-emerald-500" />
        <rect x={244} y={105} width={90} height={6} rx={3} className="fill-slate-200" />
        <Control x={222} y={30} kind="pointer" />
        <Control x={246} y={30} kind="stop" />
        <Control x={270} y={30} kind="open" />
      </g>
      <LinkBadge x={198} y={30} />
      <LinkBadge x={398} y={30} />
      <Label x={110} y={150} anchor="middle" size={11} tone="muted">
        Labelled with its host
      </Label>
      <Label x={310} y={150} anchor="middle" size={11} tone="muted">
        Loaded, with open in a new tab
      </Label>
    </Scene>
  );
}
