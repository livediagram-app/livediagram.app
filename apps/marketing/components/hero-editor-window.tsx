// The editor-window mock every hero stage window is drawn in: the editor's chrome kept in step
// with today's editor, around a caller-supplied SVG diagram (docs/specs/019-marketing/marketing-site.md).

import { type CSSProperties, type ReactNode } from 'react';
import {
  Brand,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuIcon,
  PrivateDotIcon,
  Chip,
  SharedDotIcon,
  TabsLabelIcon,
} from '@livediagram/ui';
import { SLIDES } from './hero-diagrams';
import { EyeGlyph, Shape, ShareGlyph, StarGlyph, TabAvatar } from './hero-illustration-glyphs';
import {
  CanvasCluster,
  TabBarToolbelt,
  ToolbarMenuButton,
  ToolbarStrip,
} from './hero-editor-chrome';
import { HeroThemeDialog } from './hero-theme-dialog';
import { HERO_CANVAS_ATTR } from './hero-launch';

export type TabDef = { name: string; color: string; active?: boolean };

// Every window sits on the Default scheme's canvas (the --art-* palette in
// hero-animations.css, its light or dark half with the appearance), dotted as the
// editor dots it: 1px dots on a 24px grid. The flowchart recolours from it to Forest
// in light and Pine in dark (the hero-theme / hero-theme-canvas keyframes).
const CANVAS =
  'bg-(color:--art-paper) bg-[radial-gradient(circle_at_center,_var(--hero-grid,var(--art-grid))_1px,_transparent_1px)] bg-[size:24px_24px]';

// A tab pill in the accent it is given as --tab. Dark lifts that accent 60% toward
// white, as the editor's legibleTabAccent does for the dark bar.
const TAB_PILL =
  'flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-(--tab) dark:text-[color-mix(in_srgb,var(--tab)_40%,white)]';

// The palette mock's Favourites grid: the editor's default go-to tiles.
const PALETTE_TILES: { kind: string; label: string }[] = [
  { kind: 'rect', label: 'Square' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'text', label: 'Text' },
  { kind: 'arrow', label: 'Arrow' },
  { kind: 'frame', label: 'Frame' },
  { kind: 'note', label: 'Note' },
  { kind: 'image', label: 'Image' },
  { kind: 'pen', label: 'Shape Pen' },
];

// The Layers panel rows on the timeline window.
const LAYER_ROWS: { name: string; swatch: string; hidden: boolean }[] = [
  { name: 'Milestones', swatch: '#f59e0b', hidden: false },
  { name: 'Axis', swatch: '#b45309', hidden: false },
  { name: 'Notes', swatch: '#94a3b8', hidden: true },
];

// One editor-window mock: shared chrome plus a caller-supplied SVG diagram.
// The diagram group is keyed on `playing` so its build animation restarts each
// time the window reaches centre; off-centre it gets .hero-static (settled).
export function EditorWindow({
  title,
  tabs,
  document: liveDoc,
  playing,
  shared,
  theming,
  showCursor,
  layers,
  tool,
  presenting,
  overlay,
  toolbar = false,
  empty = false,
  veil = true,
}: {
  title: string;
  tabs: TabDef[];
  document: ReactNode;
  playing: boolean;
  shared: boolean;
  theming: boolean;
  showCursor: boolean;
  layers: boolean;
  tool: string | [string, string];
  presenting: boolean;
  // Drawn over the canvas, above the diagram (the launch window's invitation and empty banner).
  overlay?: ReactNode;
  // The Toolbar panel layout (docs/specs/007-editor/toolbar-layout.md): the Palette is a strip
  // at the top centre and a menu button stands where the Explorer would float.
  toolbar?: boolean;
  // A new document with nothing on it yet: undo and redo sit disabled.
  empty?: boolean;
  // The end-of-cycle veil hides a build snapping back to its first frame; a window with no build
  // (the launch window) has nothing to hide and holds longer than a cycle, so it goes without.
  veil?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-brand-500/10 dark:border-slate-800 dark:bg-slate-900">
      <div className="relative overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
        {/* The fade. While playing it lifts from light grey over the first
            beat and drops back to it over the last second, timed to the 16s cycle,
            so the window's ending is the same whatever its last beat was and
            the stage advances behind the grey. When the window stops playing
            it is remounted to lift once more, so the peeking card doesn't
            snap from grey to its settled frame. */}
        {veil ? (
          <div
            key={playing ? 'play' : 'idle'}
            aria-hidden
            className={`pointer-events-none absolute inset-0 z-20 bg-slate-200 dark:bg-slate-950 ${
              playing ? 'hero-fade' : 'hero-fade-out'
            }`}
          />
        ) : null}
        {/* Presenting is full screen (docs/specs/012-collaboration/presentation-mode.md): no header, no tab bar, no
            panels, just the slide's canvas and the HUD. */}
        {presenting ? null : (
          <>
            {/* Editor header strip (static chrome) */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Brand size="sm" />
                {/* The Editor menu, as the real header carries it. */}
                <span className="optical-edges hidden items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <MenuIcon size={9} />
                  <span className="text-optical-line">Editor</span>
                  <ChevronDownIcon size={8} />
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="hidden truncate text-xs text-slate-400 sm:inline">{title}</span>
                {/* The editor's own share-state chip (Chip), so the art cannot drift from it. */}
                {shared ? (
                  <Chip
                    height={19}
                    caps
                    icon={<SharedDotIcon className="text-emerald-500" />}
                    className="bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                  >
                    Shared
                  </Chip>
                ) : (
                  <Chip
                    height={19}
                    caps
                    icon={<PrivateDotIcon className="text-amber-500" />}
                    className="bg-amber-50 px-2 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
                  >
                    Private
                  </Chip>
                )}
              </div>
              <span className="optical-edges inline-flex items-center gap-1 rounded-md bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-brand-600">
                <ShareGlyph />
                <span className="text-optical-line">Share</span>
              </span>
            </div>
          </>
        )}

        {/* Canvas surface. The flowchart additionally animates its theme beat
            (overriding the resting colour) while it is centred. */}
        <div
          {...{ [HERO_CANVAS_ATTR]: '' }}
          className={
            'relative ' +
            CANVAS +
            ' ' +
            (presenting ? 'h-[382px] sm:h-[442px]' : 'h-[300px] sm:h-[360px]') +
            (theming && playing ? ' hero-theme-canvas' : '')
          }
        >
          {/* Floating palette mockup (static chrome), as the editor's: the
              tool + category pickers, the element search, and the Favourites
              grid of labelled tiles. On the timeline window it is minimised
              to its header bar, the way a panel folds in the editor. */}
          {presenting ? (
            <div className="absolute right-2 top-2 hidden items-center gap-2 rounded-xl bg-slate-900/75 px-2.5 py-1.5 text-[9px] font-medium text-white shadow-lg backdrop-blur sm:flex">
              <ChevronLeftIcon size={9} />
              <span className="relative inline-block h-3 w-28 text-left">
                {(playing ? SLIDES : SLIDES.slice(-1)).map((slide, i) => (
                  <span
                    key={slide.name}
                    className={`absolute inset-0 whitespace-nowrap ${
                      playing ? `hero-slide-hud hero-slide-hud${i + 1}` : ''
                    }`}
                  >
                    <span className="text-white/60">
                      {SLIDES.indexOf(slide) + 1} / {SLIDES.length}
                    </span>
                    <span className="ml-1.5">{slide.name}</span>
                  </span>
                ))}
              </span>
              <ChevronRightIcon size={9} />
              <span className="ml-1 border-l border-white/20 pl-2 text-white/70">Notes</span>
              <span className="text-white/70">✕</span>
            </div>
          ) : null}
          {toolbar ? (
            <>
              <ToolbarMenuButton />
              <ToolbarStrip />
            </>
          ) : null}
          {layers ? (
            <div className="absolute right-2 top-2 hidden items-center gap-3 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-md sm:flex dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Palette
              </p>
              <span className="text-[10px] leading-none text-slate-400">+</span>
            </div>
          ) : null}
          <div
            className={
              'absolute right-2 top-2 w-40 flex-col rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 ' +
              (layers || presenting || toolbar ? 'hidden' : 'hidden sm:flex')
            }
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1 dark:border-slate-800">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Palette
              </p>
              <span className="flex gap-1 text-slate-300 dark:text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1 text-[9px] font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <span className="inline-flex items-center gap-0.5">
                {typeof tool === 'string' ? (
                  tool
                ) : playing ? (
                  // Two beats: the first name shows, then the second takes
                  // over when its tool comes into play (hero-tool-a / -b).
                  <span className="relative inline-block h-3 w-14">
                    <span className="hero-tool-a absolute inset-0">{tool[0]}</span>
                    <span className="hero-tool-b absolute inset-0">{tool[1]}</span>
                  </span>
                ) : (
                  tool[1]
                )}
                <ChevronDownIcon size={8} />
              </span>
              <span className="inline-flex items-center gap-0.5">
                <StarGlyph />
                Favourites
                <ChevronDownIcon size={8} />
              </span>
            </div>
            <div className="px-1.5 pt-1.5">
              <div className="flex rounded-md border border-slate-200 px-1.5 py-0.5 text-[8px] text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-optical-line">Search all elements</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-0.5 p-1.5">
              {PALETTE_TILES.map((t) => (
                <span
                  key={t.kind}
                  className="flex flex-col items-center gap-0.5 rounded py-0.5 text-slate-500 dark:text-slate-400"
                >
                  <Shape kind={t.kind} />
                  <span className="text-[7px] leading-none text-slate-500 dark:text-slate-400">
                    {t.label}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* The Layers panel (docs/specs/006-document/layers.md), docked on the timeline window: one
              row per layer with its eye toggle, the hidden one dimmed. */}
          {layers ? (
            <div className="absolute left-2 top-2 hidden w-32 flex-col rounded-lg border border-slate-200 bg-white shadow-md sm:flex dark:border-slate-800 dark:bg-slate-900">
              <p className="border-b border-slate-100 px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Layers
              </p>
              {LAYER_ROWS.map((row) => (
                <span
                  key={row.name}
                  className={
                    'flex items-center gap-1.5 px-2 py-1 text-[9px] font-medium ' +
                    (row.hidden
                      ? 'text-slate-300 dark:text-slate-600'
                      : 'text-slate-600 dark:text-slate-300')
                  }
                >
                  <EyeGlyph off={row.hidden} />
                  <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: row.swatch }} />
                  {row.name}
                </span>
              ))}
            </div>
          ) : null}

          {/* The canvas cluster (static chrome), drawn from the editor's own glyphs. */}
          <CanvasCluster
            className={'absolute bottom-2 right-2 ' + (presenting ? 'hidden' : 'hidden sm:flex')}
            empty={empty}
          />

          {/* The diagram centres in the canvas left clear by the open palette
              (or, on the timeline window, by the Layers panel), so no node
              sits under a panel. */}
          <div
            className={
              'absolute inset-y-0 left-0 right-0 ' +
              (layers ? 'sm:left-36' : presenting || toolbar ? '' : 'sm:right-44')
            }
          >
            <svg
              className="h-full w-full"
              viewBox="0 -60 600 400"
              preserveAspectRatio="xMidYMid meet"
            >
              <g key={playing ? 'play' : 'idle'} className={playing ? undefined : 'hero-static'}>
                {liveDoc}
              </g>
            </svg>
          </div>

          {/* The Tab Look & Feel dialog (docs/specs/011-theme/canvas-and-theme-dialog.md): opens over the canvas,
              a theme card is picked (the selection ring moves, the pointer
              dips), it closes, and the recolour follows. Themed window only. */}
          {theming && playing ? <HeroThemeDialog /> : null}

          {overlay}

          {/* Remote collaborator's cursor sweeping the canvas (flowchart card
              only; the mind-map card uses an in-canvas laser pointer, the
              private timeline has no collaborators). */}
          {showCursor && playing ? (
            <span className="hero-cursor pointer-events-none absolute" aria-hidden>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="#ec4899"
                stroke="white"
                strokeWidth="1"
              >
                <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
              </svg>
              <span
                className="absolute -top-3 left-3 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: '#ec4899' }}
              >
                JR
              </span>
            </span>
          ) : null}
        </div>

        {presenting ? null : (
          <>
            {/* Bottom tab bar (static chrome): colour-coded tabs relevant to this
                diagram + the toolbelt the page advertises. */}
            <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-900">
              <span
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                aria-hidden
              >
                <TabsLabelIcon />
                Tabs
              </span>
              <div className="flex min-w-0 items-center gap-1">
                {tabs.map((t) => (
                  <span
                    key={t.name}
                    style={
                      {
                        '--tab': t.color,
                        ...(t.active ? { backgroundColor: `${t.color}1a` } : {}),
                      } as CSSProperties
                    }
                    className={TAB_PILL}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className={t.active ? '' : 'text-slate-500 dark:text-slate-400'}>
                      {t.name}
                    </span>
                    {/* Presence lives IN the tab, as the editor's TabPresenceStack
                        draws it: a stack of small initials between the tab name
                        and its ellipsis, one per person on that tab (you, and on
                        a shared document whoever else is there). */}
                    {t.active ? (
                      <span className="ml-0.5 flex items-center">
                        <TabAvatar initials="TM" color="#0ea5e9" last={!shared} />
                        {shared ? <TabAvatar initials="JR" color="#ec4899" last /> : null}
                      </span>
                    ) : null}
                    {t.active ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                        <circle cx="3" cy="7" r="1.25" fill="currentColor" />
                        <circle cx="7" cy="7" r="1.25" fill="currentColor" />
                        <circle cx="11" cy="7" r="1.25" fill="currentColor" />
                      </svg>
                    ) : null}
                  </span>
                ))}
                <span className="px-1 text-base leading-none text-slate-400">+</span>
              </div>
              {/* Toolbelt: hidden on mobile (it clashes with the tabs in the
                  narrower windows), shown from sm up. */}
              <TabBarToolbelt />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
