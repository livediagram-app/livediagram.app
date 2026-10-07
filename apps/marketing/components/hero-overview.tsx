import { EDITOR_MODE_ICONS } from '@livediagram/ui';
import type { ComponentType, ReactNode } from 'react';
import { CANVAS, LANDSCAPE_VIEWBOX } from './hero-editor-window';
import { ArticlePage } from './hero-article-page';
import { DiagramBoard } from './hero-diagram-board';
import { DrawBoard } from './hero-draw-board';
import { InfographicPages } from './hero-illustrate-page';
import { MindMapBoard } from './hero-mindmap-board';
import { PlanBoard } from './hero-plan-board';
import { TownHallBoard } from './hero-townhall-board';
import type { HeroMode } from './hero-mode-palette';

// The hero's first window (docs/specs/019-marketing/marketing-site.md "Hero"): an overview of every
// window that follows, a bare board (no editor chrome) with one named frame per scene. Each frame
// draws its scene settled (the same components the windows play, under .hero-static), and pressing
// one moves the stage to that window. Four over three on a wide window; two across on a phone, narrower so its four rows fit.

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
  townhall: () => <TownHallBoard />,
  plan: () => <PlanBoard />,
};

export function HeroOverview({
  scenes,
  onOpen,
}: {
  scenes: readonly OverviewScene[];
  onOpen: (key: string) => void;
}) {
  // A bare board, not an editor window: the card the other windows sit in, its paper and dot grid,
  // and nothing else. It fills its card, whose height comes from the windows beside it.
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-brand-500/10 dark:border-slate-800 dark:bg-slate-900">
      {/* The frames are placed over the board, not in its flow, so the card takes its height from
          the windows beside it and never grows taller than they are. */}
      <div
        className={`relative h-full overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800 ${CANVAS}`}
      >
        <div className="hero-overview-frames absolute inset-0 flex flex-wrap content-center justify-center gap-x-4 gap-y-3 px-3 py-3 sm:gap-x-8 sm:gap-y-5 sm:px-6 sm:py-5">
          {scenes.map((scene) => (
            <OverviewFrame key={scene.key} scene={scene} onOpen={onOpen} />
          ))}
        </div>
      </div>
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
      className="group/frame flex w-[42%] flex-col text-left sm:w-[calc((100%-6rem)/4)] sm:max-w-[13rem]"
    >
      {/* The frame's name, above its top-left corner, as the editor labels a frame. */}
      <span className="mb-1.5 flex items-center gap-1 px-0.5 text-[9px] font-semibold text-slate-500 transition-colors group-hover/frame:text-brand-600 sm:text-xs dark:text-slate-400 dark:group-hover/frame:text-brand-300">
        <Icon size={11} className="shrink-0" />
        {scene.label}
        <span
          aria-hidden
          className="ml-auto opacity-0 transition-opacity group-hover/frame:opacity-100"
        >
          Watch ›
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
