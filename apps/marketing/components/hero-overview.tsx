import { EDITOR_MODE_ICONS } from '@livediagram/ui';
import type { ComponentType, ReactNode } from 'react';
import { LANDSCAPE_VIEWBOX } from './hero-editor-window';
import { ArticlePage } from './hero-article-page';
import { DiagramBoard } from './hero-diagram-board';
import { DrawBoard } from './hero-draw-board';
import { InfographicPages } from './hero-illustrate-page';
import { MindMapBoard } from './hero-mindmap-board';
import type { HeroMode } from './hero-mode-palette';

// The hero's first window (docs/specs/019-marketing/marketing-site.md "Hero"): an overview of every
// window that follows, as the editor shows a board zoomed out, one named frame per scene. Each frame
// draws its scene settled (the same components the windows play, under .hero-static), and pressing
// one moves the stage to that window. One row of five on a wide window, clear of the strip above and
// the canvas cluster below; two across on a phone.

export type OverviewScene = {
  key: string;
  label: string;
  mode: HeroMode;
};

const SCENES: Record<string, () => ReactNode> = {
  diagram: () => <DiagramBoard />,
  draw: () => <DrawBoard />,
  mindmap: () => <MindMapBoard />,
  infographic: () => <InfographicPages />,
  article: () => <ArticlePage />,
};

export function HeroOverview({
  scenes,
  onOpen,
}: {
  scenes: readonly OverviewScene[];
  onOpen: (key: string) => void;
}) {
  return (
    <div className="absolute inset-x-3 bottom-3 top-16 flex flex-col justify-center sm:inset-x-5 sm:bottom-12 sm:top-14">
      {/* On a wide window the board carries a heading, as a canvas text element would, and a hint
          under the frames; a phone's taller board spends that room on the frames. */}
      <p className="mb-5 hidden px-0.5 text-left text-xl font-semibold tracking-tight text-(--art-text) sm:block">
        One canvas, every way to work
      </p>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-3 sm:flex-nowrap sm:gap-x-3">
        {scenes.map((scene) => (
          <OverviewFrame key={scene.key} scene={scene} onOpen={onOpen} />
        ))}
      </div>
      <p className="mt-4 hidden px-0.5 text-left text-xs font-medium text-slate-500 sm:block dark:text-slate-400">
        Pick a frame to see it built, live.
      </p>
    </div>
  );
}

function OverviewFrame({ scene, onOpen }: { scene: OverviewScene; onOpen: (key: string) => void }) {
  const Icon: ComponentType<{ size?: number; className?: string }> = EDITOR_MODE_ICONS[scene.mode];
  const draw = SCENES[scene.key];
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => {
        // The window itself centres on a press; a frame goes straight to its own window.
        e.stopPropagation();
        onOpen(scene.key);
      }}
      className="group/frame flex w-[calc(50%-0.375rem)] flex-col text-left sm:w-[calc(20%-0.6rem)]"
    >
      {/* The frame's name, above its top-left corner, as the editor labels a frame. */}
      <span className="mb-1 flex items-center gap-1 px-0.5 text-[9px] font-semibold text-slate-500 transition-colors group-hover/frame:text-brand-600 sm:text-[10px] dark:text-slate-400 dark:group-hover/frame:text-brand-300">
        <Icon size={10} className="shrink-0" />
        {scene.label}
        <span
          aria-hidden
          className="ml-auto opacity-0 transition-opacity group-hover/frame:opacity-100"
        >
          Open ›
        </span>
      </span>
      <span className="block overflow-hidden rounded-lg border border-slate-200 bg-(--art-paper) shadow-sm transition duration-micro group-hover/frame:border-brand-400 group-hover/frame:shadow-md motion-safe:group-hover/frame:-translate-y-0.5 dark:border-slate-700 dark:group-hover/frame:border-brand-500/70">
        <svg
          className="block aspect-[3/2] w-full"
          viewBox={LANDSCAPE_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <g className="hero-static">{draw ? draw() : null}</g>
        </svg>
      </span>
    </button>
  );
}
