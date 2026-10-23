// The editor-window mock every hero stage window is drawn in: the editor's chrome kept in step
// with today's editor, around a caller-supplied SVG diagram (docs/specs/019-marketing/marketing-site.md).

import { type CSSProperties, type ReactNode } from 'react';
import {
  Brand,
  ChevronDownIcon,
  Chip,
  MenuIcon,
  PrivateDotIcon,
  SharedDotIcon,
  TabsLabelIcon,
} from '@livedesign/ui';
import { ShareGlyph, TabAvatar } from './hero-illustration-glyphs';
import {
  CanvasCluster,
  TabBarToolbelt,
  ToolbarMenuButton,
  ToolbarStrip,
} from './hero-editor-chrome';

// Every window's diagram is drawn in this box on a wide screen.
const LANDSCAPE_VIEWBOX = '0 -60 600 400';

export type TabDef = { name: string; color: string; active?: boolean };

// Every window sits on the Default scheme's canvas (the --art-* palette in
// hero-animations.css, its light or dark half with the appearance), dotted as the
// editor dots it: 1px dots on a 24px grid.
export const CANVAS =
  'bg-(color:--art-paper) bg-[radial-gradient(circle_at_center,_var(--art-grid)_1px,_transparent_1px)] bg-[size:24px_24px]';

// A tab pill in the accent it is given as --tab. Dark lifts that accent 60% toward
// white, as the editor's legibleTabAccent does for the dark bar.
const TAB_PILL =
  'flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[11px] font-medium text-(--tab) dark:text-[color-mix(in_srgb,var(--tab)_40%,white)]';
// The active tab is outlined in its accent, as the editor's TabPill outlines it.
const TAB_ACTIVE =
  'bg-white ring-1 ring-[color-mix(in_srgb,var(--tab)_45%,white)] shadow-sm dark:bg-slate-900 dark:ring-[color-mix(in_srgb,var(--tab)_45%,transparent)]';

// One editor-window mock: shared chrome plus a caller-supplied SVG diagram.
// The diagram group is keyed on `playing` so its build animation restarts each
// time the window reaches centre; off-centre it gets .hero-static (settled).
export function EditorWindow({
  title,
  tabs,
  design: liveDoc,
  viewBox = LANDSCAPE_VIEWBOX,
  playing,
  veil,
  shared,
  overlay,
  canvasClassName = 'h-[460px] sm:h-[360px]',
}: {
  title: string;
  tabs: TabDef[];
  design: ReactNode;
  // The diagram's viewBox: the wide landscape one, or a phone's portrait one for a portrait layout.
  viewBox?: string;
  playing: boolean;
  // The veil's animation, when the stage's own (lift in, close at the end; lift once on leaving)
  // does not fit: a landing beat's first play starts clear (hero-fade-end), and a resting scene
  // has none (opacity-0).
  veil?: string;
  shared: boolean;
  // Drawn over the canvas, above the diagram (the Build yours button).
  overlay?: ReactNode;
  // The canvas's size: the hero's fixed heights, or an aspect ratio where the window's width
  // varies with its column (a landing beat), so the scene keeps its proportions.
  canvasClassName?: string;
}) {
  return (
    <div className="@container/window rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-brand-500/10 dark:border-slate-800 dark:bg-slate-900">
      <div className="relative overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
        {/* The fade. While playing it lifts from light grey over the first
            beat and drops back to it over the last second, timed to the 22s cycle,
            so the window's ending is the same whatever its last beat was and
            the stage advances behind the grey. When the window stops playing
            it is remounted to lift once more, so the peeking card doesn't
            snap from grey to its settled frame. */}
        <div
          key={playing ? 'play' : 'idle'}
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-20 bg-slate-200 dark:bg-slate-950 ${
            veil ?? (playing ? 'hero-fade' : 'hero-fade-out')
          }`}
        />
        {/* Editor header strip (static chrome), laid out as EditorHeader lays it out: the brand
            and the Editor menu on the left, the design's name with its share state and your role
            in the middle, and Share on the right behind a hairline. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-100 bg-white py-1.5 pl-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-2">
            <Brand size="sm" />
            <span className="hidden h-6 items-center gap-1 rounded-md border border-slate-200 px-1.5 text-[9px] font-medium text-slate-600 shadow-sm @min-[560px]/window:flex dark:border-slate-700 dark:text-slate-300">
              <MenuIcon size={9} />
              <span className="text-optical-line">Editor</span>
              <ChevronDownIcon size={6} />
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="hidden truncate text-[11px] font-medium text-slate-600 sm:inline dark:text-slate-300">
              {title}
            </span>
            {/* The editor's own share-state chip (Chip), so the art cannot drift from it. */}
            {shared ? (
              <Chip
                height={17}
                caps
                icon={<SharedDotIcon className="text-emerald-500" />}
                className="bg-emerald-50 px-1.5 text-[8px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
              >
                Shared
              </Chip>
            ) : (
              <Chip
                height={17}
                caps
                icon={<PrivateDotIcon className="text-amber-500" />}
                className="bg-amber-50 px-1.5 text-[8px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
              >
                Private
              </Chip>
            )}
            {/* Your role on it, as the editor's RoleIndicator pill shows it. */}
            <Chip
              height={17}
              caps
              className="bg-emerald-100 px-1.5 text-[8px] font-semibold text-emerald-800 @max-[480px]/window:hidden dark:bg-emerald-500/15 dark:text-emerald-200"
            >
              Editing
            </Chip>
          </div>
          <span className="flex flex-col items-center justify-self-end gap-0.5 border-l border-slate-100 px-3 text-[8px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <ShareGlyph />
            Share
          </span>
        </div>

        {/* Canvas surface. */}
        <div className={`hero-glyph-ink @container relative ${canvasClassName} ${CANVAS}`}>
          {/* The Toolbar panel layout (docs/specs/007-editor/toolbar-layout.md): the Palette is a
              strip at the top centre and a menu button stands where the Explorer would float. */}
          <ToolbarMenuButton tab={tabs.find((t) => t.active)?.name ?? tabs[0]!.name} />
          <ToolbarStrip />

          {/* The canvas cluster (static chrome), drawn from the editor's own glyphs. */}
          <CanvasCluster className="absolute bottom-2 right-2 z-10 hidden sm:flex" />

          {/* The diagram centres in the canvas below the strip, with clear space under it (more on a
              phone, whose portrait layouts run nearer the top), so nothing crowds the toolbar. */}
          <div className="absolute inset-x-0 bottom-2 top-16 sm:bottom-0 sm:top-10">
            <svg className="h-full w-full" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
              <g key={playing ? 'play' : 'idle'} className={playing ? undefined : 'hero-static'}>
                {liveDoc}
              </g>
            </svg>
          </div>

          {overlay}
        </div>

        {/* Bottom tab bar (static chrome): colour-coded tabs relevant to this
                diagram + the toolbelt the page advertises. */}
        <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-900">
          {/* The tab folder chip, the bar's first control. */}
          <span className="flex items-center text-slate-400" aria-hidden>
            <TabsLabelIcon />
          </span>
          <div className="flex min-w-0 items-center gap-1">
            {tabs.map((t) => (
              <span
                key={t.name}
                style={{ '--tab': t.color } as CSSProperties}
                className={`${TAB_PILL} ${t.active ? TAB_ACTIVE : ''}`}
              >
                <span className={t.active ? '' : 'text-slate-500 dark:text-slate-400'}>
                  {t.name}
                </span>
                {/* Presence lives IN the tab, as the editor's TabPresenceStack
                        draws it: a stack of small initials between the tab name
                        and its ellipsis, one per person on that tab (you, and on
                        a shared design whoever else is there). */}
                {t.active ? (
                  <span className="ml-0.5 flex items-center">
                    <TabAvatar initials="TM" color="#e11d48" last={!shared} />
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
      </div>
    </div>
  );
}
